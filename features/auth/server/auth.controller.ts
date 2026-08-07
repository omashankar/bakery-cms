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
  rateLimit(`login:${ctx.ip}`, { limit: loginAttemptLimit(policy), windowMs: 60_000 });

  const input = validate(loginSchema, await readJson(request));
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
  rateLimit(`forgot:${ctx.ip}`, { limit: 5, windowMs: 60_000 });

  const input = validate(forgotPasswordSchema, await readJson(request));
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
