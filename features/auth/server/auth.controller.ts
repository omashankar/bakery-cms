import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { rateLimit } from "@/lib/server/http/rate-limit";
import {
  getSecurityPolicy,
  loginAttemptLimit,
} from "@/features/settings/server/security-policy.server";
import { requireSession, getCurrentUser } from "@/lib/server/auth/dal";
import { getRefreshCookie } from "@/lib/server/auth/cookies";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./auth.service";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "./auth.validators";

/**
 * Controllers: thin orchestration only. Read/validate input, call the service,
 * shape the response envelope. No business logic, no DB access here.
 */

export const loginController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  // The shop's own "Max login attempts", not a hardcoded ten. That number
  // sat on the Security screen with nothing reading it, so an owner who set
  // three got ten. Clamped in `loginAttemptLimit`, because this value gates
  // authentication and a stored 0 would lock everyone out.
  const policy = await getSecurityPolicy();
  const limit = loginAttemptLimit(policy);
  const input = validate(loginSchema, await readJson(request));

  /**
   * Keyed on something the caller cannot rotate for free.
   *
   * This was `login:${ctx.ip}` alone, and `ctx.ip` came from the FIRST hop of
   * `x-forwarded-for` — a header the client writes. The limiter mints a fresh
   * bucket for every key it has not seen, so "Max login attempts: 3" meant
   * three attempts per header value and one extra header per request reset it.
   *
   * `clientIpFrom` now answers "" unless the deployment declares a trusted
   * proxy, and "" must not become a rate-limit key: every visitor would share
   * one bucket and a stranger could lock the whole shop out of signing in. So
   * the ACCOUNT carries the limit — an attacker can rotate addresses but not
   * the account they are trying to get into — and the address is an additional
   * budget only where it is real.
   *
   * The trade is deliberate and small: someone can burn a given account's
   * attempts and keep its owner out for the rest of the 60-second window. That
   * is a minute of inconvenience against a throttle that could otherwise be
   * bypassed entirely, on every deployment that is not behind a configured
   * proxy — which is the default.
   */
  rateLimit(`login:acct:${input.email.trim().toLowerCase()}`, { limit, windowMs: 60_000 });
  if (ctx.ip) rateLimit(`login:ip:${ctx.ip}`, { limit, windowMs: 60_000 });
  const user = await service.login(input, ctx);
  return ok(user, "Signed in successfully");
});

export const logoutController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const refresh = await getRefreshCookie();
  await service.logout(refresh, ctx);
  return ok(null, "Signed out");
});

export const refreshController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const refresh = await getRefreshCookie();
  const user = await service.refresh(refresh, ctx);
  return ok(user, "Session refreshed");
});

export const meController = withErrorHandler(async () => {
  await requireSession();
  const user = await getCurrentUser();
  return ok(user, "Current user");
});

export const forgotPasswordController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(forgotPasswordSchema, await readJson(request));

  // Same reasoning as the login throttle, and the same stakes: this one sends
  // real mail from the shop's SMTP account, so a key the caller can rotate is
  // a way to empty that account's sending quota.
  rateLimit(`forgot:acct:${input.email.trim().toLowerCase()}`, { limit: 5, windowMs: 60_000 });
  if (ctx.ip) rateLimit(`forgot:ip:${ctx.ip}`, { limit: 5, windowMs: 60_000 });
  await service.forgotPassword(input, ctx);
  // Always the same message — do not reveal whether the email exists.
  return ok(null, "If that email is registered, a reset code has been sent");
});

export const verifyOtpController = withErrorHandler(async (request: Request) => {
  const input = validate(verifyOtpSchema, await readJson(request));
  await service.verifyOtp(input);
  return ok(null, "Code verified");
});

export const resetPasswordController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(resetPasswordSchema, await readJson(request));
  await service.resetPassword(input, ctx);
  return ok(null, "Password updated. Please sign in.");
});

export const changePasswordController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const session = await requireSession();
  const input = validate(changePasswordSchema, await readJson(request));
  await service.changePassword(session.sub, input, ctx);
  return ok(null, "Password changed");
});
