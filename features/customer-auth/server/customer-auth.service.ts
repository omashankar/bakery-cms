import { timingSafeEqual } from "node:crypto";

import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { generateOtp, sha256 } from "@/lib/server/auth/hash";
import { AppError, AuthError } from "@/lib/server/http/errors";
import { sendTemplatedEmail } from "@/features/communications/server/email.service";
import * as orderRepo from "@/features/orders/server/order.repository";

import * as repo from "./customer-auth.repository";
import type { RequestCodeInput, VerifyCodeInput } from "./customer-auth.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
}

/**
 * Ten minutes: long enough to find the email on another device, short enough
 * that a code sitting in an unattended inbox stops working.
 */
const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Five wrong guesses burn the code.
 *
 * A 6-digit code is 1-in-a-million per guess, which is only meaningful while
 * the number of guesses is capped. The counter lives on the database row rather
 * than in memory: a per-process counter resets on every deploy and is not
 * shared between instances, so it would cap nothing that mattered.
 */
const MAX_ATTEMPTS = 5;

export interface CustomerIdentity {
  id: string;
  email: string;
  name: string;
  phone: string;
}

/**
 * Compare two hex digests without leaking, through timing, how much of the
 * value matched. `sha256` output is fixed-length so the lengths always agree.
 */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * What this customer has already told the shop, taken from their most recent
 * order.
 *
 * A first-time sign-in should not ask for a name the shop already has on three
 * of their orders. It is also what makes the account and the order history
 * obviously the same person on the very first screen.
 */
async function identityFromOrders(email: string): Promise<{ name: string; phone: string }> {
  try {
    const orders = await orderRepo.findByCustomerEmail(email);
    const latest = orders[0];
    return {
      name: latest?.address?.fullName?.trim() ?? "",
      phone: latest?.address?.phone?.trim() ?? "",
    };
  } catch {
    // Never block a sign-in over a nicety.
    return { name: "", phone: "" };
  }
}

/**
 * Email a one-time code.
 *
 * Unlike the admin's forgot-password flow, this does NOT have to hide whether
 * the address is registered — every address can sign in, and the account is
 * created on first use. So a delivery failure is reported honestly instead of
 * being swallowed to protect a secret that does not exist here. The rule the
 * mail module states applies: `sent` is the only honest basis for telling
 * anyone an email went out.
 */
export async function requestSignInCode(
  input: RequestCodeInput,
  ctx: RequestCtx,
): Promise<{ expiresInMinutes: number }> {
  const existing = await repo.findAccountByEmail(input.email);
  if (existing?.blocked) {
    // Same shape as a wrong code, deliberately: a blocked address must not be
    // able to tell it is blocked rather than simply wrong.
    throw new AuthError("We could not sign you in. Please contact the store.");
  }

  const code = generateOtp();
  await repo.replaceLoginCode({
    email: input.email,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    ip: ctx.ip,
  });

  const known = existing
    ? { name: existing.name ?? "", phone: existing.phone ?? "" }
    : await identityFromOrders(input.email);

  const mail = await sendTemplatedEmail("customer_sign_in", input.email, {
    customer_name: known.name || input.name?.trim() || "there",
    sign_in_code: code,
    expires_in: `${Math.round(CODE_TTL_MS / 60_000)} minutes`,
  });

  await writeAuditLog({
    action: "customer.sign_in.request",
    actorEmail: input.email,
    target: { type: "customer", id: input.email },
    // Never the code. A plaintext sign-in code in an audit row is an account
    // takeover for anyone who can read the audit log.
    metadata: { delivered: mail.sent },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  if (!mail.sent) {
    // The customer cannot act on an SMTP error, and there is nothing they could
    // do differently — but they must not be left waiting for an email that is
    // never coming. The operator detail goes to the log.
    console.error(`[customer-auth] Could not email a sign-in code: ${mail.error}`);
    throw new AppError(
      "We could not send your code right now. Please try again shortly, or contact the store.",
      502,
    );
  }

  // In development the code is worth having to hand; nowhere else.
  if (process.env.NODE_ENV === "development") {
    console.info(`[customer-auth] Sign-in code for ${input.email}: ${code}`);
  }

  return { expiresInMinutes: Math.round(CODE_TTL_MS / 60_000) };
}

/**
 * Check the code and return who it belongs to.
 *
 * Creating the account here rather than at request time is what stops the
 * request endpoint from being a way to fill the database with accounts for
 * addresses nobody controls.
 */
export async function verifySignInCode(
  input: VerifyCodeInput,
  ctx: RequestCtx,
): Promise<CustomerIdentity> {
  const record = await repo.findLoginCode(input.email);
  const wrong = new AuthError("That code is not right, or it has expired. Please request another.");

  if (!record) throw wrong;

  if (record.expiresAt.getTime() <= Date.now()) {
    await repo.consumeLoginCode(input.email);
    throw wrong;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await repo.consumeLoginCode(input.email);
    throw wrong;
  }

  if (!hashesMatch(record.codeHash, sha256(input.code))) {
    const attempts = await repo.countWrongGuess(String(record.id));
    if (attempts >= MAX_ATTEMPTS) await repo.consumeLoginCode(input.email);
    await writeAuditLog({
      action: "customer.sign_in.failed",
      actorEmail: input.email,
      target: { type: "customer", id: input.email },
      metadata: { attempts },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw wrong;
  }

  // Correct. The code is spent whatever happens next.
  await repo.consumeLoginCode(input.email);

  const existing = await repo.findAccountByEmail(input.email);
  if (existing?.blocked) throw new AuthError("We could not sign you in. Please contact the store.");

  let identity: CustomerIdentity;
  if (existing) {
    await repo.markSignedIn(String(existing.id));
    identity = {
      id: String(existing.id),
      email: existing.email,
      name: existing.name ?? "",
      phone: existing.phone ?? "",
    };
  } else {
    /**
     * The account is created HERE, not when the code was requested.
     *
     * Otherwise the request endpoint would be a way to fill this collection
     * with accounts for addresses nobody controls — one POST per address.
     * Creating it only once the code comes back means every account in here
     * belongs to someone who could read the email.
     */
    const known = await identityFromOrders(input.email);
    identity = await repo.createAccount({
      email: input.email,
      name: known.name,
      phone: known.phone,
    });
  }

  await writeAuditLog({
    action: "customer.sign_in",
    actorEmail: identity.email,
    target: { type: "customer", id: identity.id },
    metadata: { newAccount: !existing },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return identity;
}

export async function updateProfile(
  id: string,
  patch: { name?: string; phone?: string },
): Promise<void> {
  await repo.updateProfile(id, patch);
}
