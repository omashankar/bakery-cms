import { ok } from "@/lib/server/http/response";
import { withErrorHandler, ConflictError } from "@/lib/server/http/errors";
import { requireRole } from "@/lib/server/auth/dal";
import { getRefreshCookie } from "@/lib/server/auth/cookies";
import { verifyRefreshToken } from "@/lib/server/auth/jwt";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./security.service";

const SECURITY_ROLES = ["owner", "admin"] as const;
type IdContext = { params: Promise<{ id: string }> };

/** The current request's session id, from the (httpOnly) refresh cookie. */
async function currentSessionId(): Promise<string | null> {
  const cookie = await getRefreshCookie();
  if (!cookie) return null;
  const claims = await verifyRefreshToken(cookie);
  return claims?.sid ?? null;
}

export const getSecurityCenterController = withErrorHandler(async () => {
  const session = await requireRole(...SECURITY_ROLES);
  const sid = await currentSessionId();
  const state = await service.getSecurityCenter(
    { id: session.sub, email: session.email },
    sid,
  );
  return ok(state, "Security center");
});

export const revokeSessionController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...SECURITY_ROLES);
  const { id } = await ctx.params;

  const sid = await currentSessionId();
  if (sid && id === sid) {
    throw new ConflictError("Cannot revoke the session you are currently using");
  }

  const revoked = await service.revokeSession(session.sub, id, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok({ revoked }, revoked ? "Session revoked" : "Session not found");
});

export const logoutAllController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...SECURITY_ROLES);
  const sid = await currentSessionId();
  const revoked = await service.logoutOtherDevices(session.sub, sid, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok({ revoked }, "Signed out of other devices");
});
