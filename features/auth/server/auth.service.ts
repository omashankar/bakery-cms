import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ttlToDate,
  REFRESH_TTL,
} from "@/lib/server/auth/jwt";
import { setAuthCookies, clearAuthCookies } from "@/lib/server/auth/cookies";
import { sha256, generateOtp } from "@/lib/server/auth/hash";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import {
  accessTokenTtl,
  getSecurityPolicy,
  sessionTimeoutMs,
} from "@/features/settings/server/security-policy.server";
import { sendTemplatedEmail } from "@/features/communications/server/email.service";
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/server/http/errors";

import * as repo from "./auth.repository";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from "./auth.validators";

/**
 * Auth business logic. Controllers call these; they never touch the DB or
 * cookies directly. Every function that changes state also writes an audit log.
 */

interface RequestCtx {
  ip: string;
  userAgent: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: string;
}

function toPublicUser(doc: {
  toJSON: () => Record<string, unknown>;
}): PublicUser {
  const json = doc.toJSON();
  return {
    id: json.id as string,
    name: json.name as string,
    email: json.email as string,
    avatar: json.avatar as string | undefined,
    role: json.role as string,
    status: json.status as string,
  };
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

// ---- Login ----------------------------------------------------------------

export async function login(input: LoginInput, ctx: RequestCtx): Promise<PublicUser> {
  const user = await repo.findUserByEmail(input.email);

  // Same generic error whether the email is unknown or the password is wrong —
  // don't reveal which emails exist. Still run a comparison even when the user
  // is missing would be ideal to avoid timing leaks; kept simple here.
  if (!user) {
    await writeAuditLog({ action: "auth.login", actorEmail: input.email, status: "failure", ...ctx });
    throw new AuthError("Invalid email or password");
  }

  if (user.status !== "active") {
    await writeAuditLog({
      action: "auth.login",
      actorId: String(user._id),
      actorEmail: user.email,
      status: "failure",
      metadata: { reason: "inactive" },
      ...ctx,
    });
    throw new ForbiddenError("This account is not active");
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    await writeAuditLog({
      action: "auth.login",
      actorId: String(user._id),
      actorEmail: user.email,
      status: "failure",
      ...ctx,
    });
    throw new AuthError("Invalid email or password");
  }

  await issueTokens(String(user._id), user.role, user.email, ctx, input.rememberMe);
  await repo.touchLastLogin(String(user._id));
  await writeAuditLog({
    action: "auth.login",
    actorId: String(user._id),
    actorEmail: user.email,
    status: "success",
    ...ctx,
  });

  return toPublicUser(user);
}

/** Create a session + refresh token and set both auth cookies. */
async function issueTokens(
  userId: string,
  role: string,
  email: string,
  ctx: RequestCtx,
  /** See `setAuthCookies` — false makes the refresh cookie session-only. */
  rememberMe = true,
) {
  const session = await repo.createSession({
    userId,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
    expiresAt: ttlToDate(REFRESH_TTL),
  });

  // The shop's configured session timeout, finally applied. Every session was
  // 15 minutes regardless of what the Security screen said.
  const accessTtl = accessTokenTtl(await getSecurityPolicy());
  const accessToken = await signAccessToken({ sub: userId, role, email }, accessTtl);
  const refreshToken = await signRefreshToken({ sub: userId, sid: String(session._id) });

  await repo.createRefreshToken({
    userId,
    sessionId: String(session._id),
    tokenHash: sha256(refreshToken),
    expiresAt: ttlToDate(REFRESH_TTL),
  });

  // The cookie carries the same lifetime as the token inside it.
  await setAuthCookies(accessToken, refreshToken, accessTtl, rememberMe);
  return { accessToken, refreshToken, sessionId: String(session._id) };
}

// ---- Refresh (rotation) ---------------------------------------------------

export async function refresh(refreshCookie: string | undefined, ctx: RequestCtx): Promise<PublicUser> {
  if (!refreshCookie) throw new AuthError("No refresh token");

  const claims = await verifyRefreshToken(refreshCookie);
  if (!claims) throw new AuthError("Invalid refresh token");

  const stored = await repo.findActiveRefreshToken(sha256(refreshCookie));
  if (!stored) {
    // Token valid by signature but not active in DB → reuse/revoked. Kill the
    // whole session as a precaution against stolen-token replay.
    await repo.deleteSession(claims.sid).catch(() => undefined);
    throw new AuthError("Refresh token is no longer valid");
  }

  const user = await repo.findUserById(claims.sub);
  if (!user || user.status !== "active") throw new AuthError("Account unavailable");

  const policy = await getSecurityPolicy();

  /**
   * The shop's configured session timeout, enforced HERE.
   *
   * The first attempt at this expressed the timeout by lengthening the access
   * token, which was worse than doing nothing: `getSession` verifies the JWT
   * alone — no session-row read, no revocation list — so the token's lifetime
   * IS the revocation lag. Raising it widened the window in which a revoked or
   * stolen token still works, while "Revoke session" and "Log out everywhere"
   * both reported success.
   *
   * The rotation is the right place: it is the moment a session either
   * continues or does not, so refusing here ends it for a real client without
   * giving a replayed token a single extra second.
   */
  const session = await repo.findSessionById(claims.sid).catch(() => null);
  if (session) {
    const idleMs = Date.now() - new Date(session.lastSeenAt).getTime();
    if (idleMs > sessionTimeoutMs(policy)) {
      await repo.deleteSession(claims.sid).catch(() => undefined);
      throw new AuthError("Session timed out");
    }
  }

  // Rotate: revoke the used token, issue a fresh pair.
  await repo.revokeRefreshToken(String(stored._id));
  await repo.touchSession(claims.sid).catch(() => undefined);

  const accessTtl = accessTokenTtl(policy);
  const accessToken = await signAccessToken(
    { sub: claims.sub, role: user.role, email: user.email },
    accessTtl,
  );
  const newRefresh = await signRefreshToken({ sub: claims.sub, sid: claims.sid });
  await repo.createRefreshToken({
    userId: claims.sub,
    sessionId: claims.sid,
    tokenHash: sha256(newRefresh),
    expiresAt: ttlToDate(REFRESH_TTL),
  });
  await setAuthCookies(accessToken, newRefresh, accessTtl);

  return toPublicUser(user);
}

// ---- Logout ---------------------------------------------------------------

export async function logout(refreshCookie: string | undefined, ctx: RequestCtx): Promise<void> {
  if (refreshCookie) {
    const claims = await verifyRefreshToken(refreshCookie);
    const stored = await repo.findActiveRefreshToken(sha256(refreshCookie));
    if (stored) await repo.revokeRefreshToken(String(stored._id));
    if (claims?.sid) await repo.deleteSession(claims.sid).catch(() => undefined);
    if (claims?.sub) {
      await writeAuditLog({ action: "auth.logout", actorId: claims.sub, status: "success", ...ctx });
    }
  }
  await clearAuthCookies();
}

// ---- Forgot / Verify / Reset ---------------------------------------------

export async function forgotPassword(input: ForgotPasswordInput, ctx: RequestCtx): Promise<void> {
  const user = await repo.findUserByEmail(input.email);
  // Always succeed to the caller — never reveal whether the email is registered.
  if (!user) return;

  const otp = generateOtp();
  await repo.createPasswordReset({
    email: input.email,
    otpHash: sha256(otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  const mail = await sendTemplatedEmail("password_reset", input.email, {
    customer_name: user.name?.trim() || "there",
    reset_code: otp,
    expires_in: `${Math.round(OTP_TTL_MS / 60_000)} minutes`,
  });

  // The response to the caller is deliberately unchanged either way: saying "we
  // couldn't email you" only for registered addresses would reveal which
  // addresses are registered, which is exactly what the early return above
  // avoids. So a delivery failure is an operator problem, logged for them.
  if (!mail.sent) {
    // Never the OTP itself. A plaintext reset code in a server log is an account
    // takeover for anyone who can read logs — a hosting dashboard, a log
    // aggregator, a shared ops account — and leaves no trace in the audit trail.
    console.error(`[auth] Could not email a password reset code: ${mail.error}`);
  }

  // In development the code is worth having to hand; nowhere else.
  if (process.env.NODE_ENV === "development") {
    console.info(`[auth] Password reset OTP for ${input.email}: ${otp}`);
  }

  await writeAuditLog({
    action: "auth.forgot_password",
    actorId: String(user._id),
    actorEmail: user.email,
    ...ctx,
  });
}

/** Verify an OTP without consuming it (gates the reset-password step). */
export async function verifyOtp(input: VerifyOtpInput): Promise<void> {
  const reset = await repo.findActiveReset(input.email);
  if (!reset) throw new AuthError("Code expired or not found. Request a new one.");

  if (reset.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ForbiddenError("Too many attempts. Request a new code.");
  }

  if (sha256(input.otp) !== reset.otpHash) {
    await repo.incrementResetAttempts(String(reset._id));
    throw new AuthError("Incorrect code");
  }
}

export async function resetPassword(input: ResetPasswordInput, ctx: RequestCtx): Promise<void> {
  const reset = await repo.findActiveReset(input.email);
  if (!reset) throw new AuthError("Code expired or not found. Request a new one.");
  if (reset.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ForbiddenError("Too many attempts. Request a new code.");
  }
  if (sha256(input.otp) !== reset.otpHash) {
    await repo.incrementResetAttempts(String(reset._id));
    throw new AuthError("Incorrect code");
  }

  const user = await repo.findUserByEmail(input.email);
  if (!user) throw new NotFoundError("Account not found");

  await repo.updateUserPassword(String(user._id), await hashPassword(input.password));
  await repo.markResetUsed(String(reset._id));

  // Security: invalidate every existing session/token after a password reset.
  await repo.revokeRefreshTokensByUser(String(user._id));
  await repo.deleteSessionsByUser(String(user._id));

  await writeAuditLog({
    action: "auth.reset_password",
    actorId: String(user._id),
    actorEmail: user.email,
    ...ctx,
  });
}

// ---- Change password (authenticated) -------------------------------------

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ctx: RequestCtx,
): Promise<void> {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError("Account not found");

  const currentOk = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentOk) throw new AuthError("Current password is incorrect");

  if (input.currentPassword === input.newPassword) {
    throw new ConflictError("New password must be different from the current one");
  }

  await repo.updateUserPassword(userId, await hashPassword(input.newPassword));
  await repo.revokeRefreshTokensByUser(userId);
  /**
   * And the session ROWS, exactly as `resetPassword` does — its comment says
   * "invalidate every existing session/token after a password reset" and it
   * calls both. This called only the first.
   *
   * The Security Center derives its device list from the surviving rows
   * (`SessionModel.find({ userId, expiresAt: { $gt: now } })`), and a row's
   * `expiresAt` is the 30-day refresh TTL. A device that never comes back never
   * self-cleans, so after changing their password an admin went on being shown
   * phones and laptops as "active" on the one screen they would check to
   * confirm the change had taken effect.
   */
  await repo.deleteSessionsByUser(userId);

  await writeAuditLog({
    action: "auth.change_password",
    actorId: userId,
    actorEmail: user.email,
    ...ctx,
  });
}
