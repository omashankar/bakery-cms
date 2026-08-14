import { requestContext } from "@/lib/server/audit/audit-log";
import {
  clearCustomerCookie,
  setCustomerCookie,
} from "@/lib/server/auth/cookies";
import { getCustomerAccount, requireCustomer } from "@/lib/server/auth/customer-dal";
import { signCustomerToken } from "@/lib/server/auth/jwt";
import { withErrorHandler } from "@/lib/server/http/errors";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { ok } from "@/lib/server/http/response";
import { readJson, validate } from "@/lib/server/http/validate";
import * as orderService from "@/features/orders/server/order.service";

import * as service from "./customer-auth.service";
import {
  requestCodeSchema,
  updateCustomerProfileSchema,
  verifyCodeSchema,
} from "./customer-auth.validators";

/**
 * Storefront sign-in. Thin orchestration only — the service owns the rules.
 */

/**
 * Sending a code costs the shop an email and the recipient an inbox, so this is
 * budgeted twice.
 *
 * On the ADDRESS first, because that is the thing being harassed and the one an
 * attacker cannot rotate for free when the goal is to bury one person's inbox.
 * On the IP as well, but only when the deployment gives us a real one —
 * `requestContext` answers "" behind an untrusted proxy, and keying a limiter
 * on "" would put every visitor in one bucket, so one script could stop the
 * whole shop signing in.
 */
export const requestCodeController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(requestCodeSchema, await readJson(request));

  rateLimit(`customer-code:${input.email}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (ctx.ip) rateLimit(`customer-code-ip:${ctx.ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });

  const result = await service.requestSignInCode(input, ctx);
  return ok(result, "Sign-in code sent");
});

export const verifyCodeController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(verifyCodeSchema, await readJson(request));

  // Guessing is budgeted separately from sending: the per-code attempt counter
  // caps one code, this caps how fast someone can churn through codes.
  rateLimit(`customer-verify:${input.email}`, { limit: 10, windowMs: 15 * 60 * 1000 });

  const identity = await service.verifySignInCode(input, ctx);
  await setCustomerCookie(await signCustomerToken({ sub: identity.id, email: identity.email }));

  return ok(identity, "Signed in");
});

/**
 * Who is signed in, if anyone.
 *
 * Answers `null` rather than 401 for a signed-out visitor: the storefront asks
 * this on every page to decide whether to show an account menu, and a 401 there
 * is not an error, it is the ordinary answer for a shopper who has not signed
 * in.
 */
export const customerMeController = withErrorHandler(async () => {
  const account = (await getCustomerAccount()) as
    | { id: string; email: string; name: string; phone: string }
    | null;

  if (!account) return ok(null, "Not signed in");
  return ok(
    { id: account.id, email: account.email, name: account.name, phone: account.phone },
    "Signed in",
  );
});

export const customerLogoutController = withErrorHandler(async () => {
  await clearCustomerCookie();
  return ok({ signedOut: true }, "Signed out");
});

export const updateCustomerProfileController = withErrorHandler(async (request: Request) => {
  const customer = await requireCustomer();
  const input = validate(updateCustomerProfileSchema, await readJson(request));

  await service.updateProfile(customer.id, input);
  return ok({ ...customer, ...input }, "Profile updated");
});

/**
 * The signed-in customer's own orders.
 *
 * The email comes from the SESSION, never from the request. The previous
 * endpoint took `?email=` and compared it to an admin session — which is the
 * right shape for staff looking a customer up, and no use at all to a customer,
 * who had no server session to compare against. My Orders therefore read this
 * browser's localStorage and nothing else: history was device-bound, frozen at
 * the moment of placing, and blind to any order the webhook had placed.
 */
export const myOrdersController = withErrorHandler(async () => {
  const customer = await requireCustomer();
  return ok(await orderService.getByCustomer(customer.email), "Your orders");
});
