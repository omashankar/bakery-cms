import { writeAuditLog } from "@/lib/server/audit/audit-log";
import type {
  ActiveSession,
  FailedLoginAttempt,
  LoginHistoryEntry,
  RegisteredDevice,
  SecurityCenterState,
} from "@/types/security";

import * as repo from "./security.repository";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/** Server-side user-agent parse (mirrors the old client parser, from a string). */
function parseUA(ua: string): { browser: string; os: string; deviceLabel: string } {
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Desktop";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os, deviceLabel: `${browser} on ${os}` };
}

function iso(value: Date | string | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function deriveDevices(sessions: ActiveSession[]): RegisteredDevice[] {
  const byLabel = new Map<string, RegisteredDevice>();
  for (const s of sessions) {
    const key = `${s.deviceLabel}|${s.ipAddress}`;
    const existing = byLabel.get(key);
    if (!existing || new Date(s.lastActiveAt) > new Date(existing.lastSeenAt)) {
      byLabel.set(key, {
        id: s.id,
        label: s.deviceLabel,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        lastSeenAt: s.lastActiveAt,
        trusted: true,
      });
    }
  }
  return [...byLabel.values()];
}

/**
 * Derive the Security Center from real data:
 *  - login history + failed attempts → the `auth.login` audit trail
 *  - active sessions + devices → the live (non-expired) SessionModel rows for
 *    this user, with the current session flagged from the refresh-token sid.
 */
export async function getSecurityCenter(
  user: { id: string; email: string },
  currentSessionId: string | null,
): Promise<SecurityCenterState> {
  const audits = await repo.recentLoginAudits(50);

  const loginHistory: LoginHistoryEntry[] = audits.map((a) => {
    const { browser, os, deviceLabel } = parseUA(a.userAgent ?? "");
    return {
      id: String(a._id),
      email: a.actorEmail ?? "",
      success: a.status !== "failure",
      ipAddress: a.ip ?? "",
      deviceLabel,
      browser,
      os,
      timestamp: iso(a.createdAt),
    };
  });

  const failedAttempts: FailedLoginAttempt[] = audits
    .filter((a) => a.status === "failure")
    .slice(0, 30)
    .map((a) => ({
      id: String(a._id),
      email: a.actorEmail ?? "",
      ipAddress: a.ip ?? "",
      reason: (a.metadata?.reason as string | undefined) ?? "Invalid email or password",
      timestamp: iso(a.createdAt),
    }));

  const sessionRows = await repo.activeSessionsForUser(user.id);
  const activeSessions: ActiveSession[] = sessionRows.map((s) => {
    const { browser, os, deviceLabel } = parseUA(s.userAgent ?? "");
    return {
      id: String(s._id),
      email: user.email,
      deviceLabel,
      browser,
      os,
      ipAddress: s.ip ?? "",
      signedInAt: iso(s.createdAt),
      lastActiveAt: iso(s.lastSeenAt),
      isCurrent: currentSessionId != null && String(s._id) === currentSessionId,
    };
  });

  return {
    loginHistory,
    failedAttempts,
    activeSessions,
    devices: deriveDevices(activeSessions),
    updatedAt: new Date().toISOString(),
  };
}

export async function revokeSession(
  userId: string,
  sessionId: string,
  ctx: RequestCtx,
): Promise<boolean> {
  const revoked = await repo.revokeSession(userId, sessionId);
  if (revoked) {
    await writeAuditLog({
      action: "security.session.revoke",
      actorId: ctx.actorId ?? userId,
      actorEmail: ctx.actorEmail,
      target: { type: "session", id: sessionId },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return revoked;
}

export async function logoutOtherDevices(
  userId: string,
  currentSessionId: string | null,
  ctx: RequestCtx,
): Promise<number> {
  const count = await repo.revokeOtherSessions(userId, currentSessionId);
  await writeAuditLog({
    action: "security.logout_all",
    actorId: ctx.actorId ?? userId,
    actorEmail: ctx.actorEmail,
    target: { type: "user", id: userId },
    metadata: { revoked: count },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return count;
}
