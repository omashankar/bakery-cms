import { connectDB } from "@/lib/server/db/mongoose";
import { revokeRefreshTokensBySession } from "@/features/auth/server/auth.repository";
import { AuditLogModel } from "@/lib/server/db/models/audit-log.model";
import { SessionModel } from "@/lib/server/db/models/session.model";

/**
 * Security repository — reads the REAL security signals (login audit trail +
 * live device sessions) and performs real session revocation. There is no
 * dedicated "security center" collection; the state is derived from these.
 */

export interface LoginAuditRaw {
  _id: unknown;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date | string;
}

export interface SessionRaw {
  _id: unknown;
  userAgent?: string;
  ip?: string;
  lastSeenAt?: Date | string;
  createdAt?: Date | string;
}

/** Most recent login events (success + failure) across all users. */
export async function recentLoginAudits(limit = 50): Promise<LoginAuditRaw[]> {
  await connectDB();
  return AuditLogModel.find({ action: "auth.login" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean() as unknown as Promise<LoginAuditRaw[]>;
}

/** Non-expired device sessions for one user (the current admin's own devices). */
export async function activeSessionsForUser(userId: string): Promise<SessionRaw[]> {
  await connectDB();
  return SessionModel.find({ userId, expiresAt: { $gt: new Date() } })
    .sort({ lastSeenAt: -1 })
    .lean() as unknown as Promise<SessionRaw[]>;
}

/** Revoke one session (delete it + revoke its refresh chain). Own sessions only. */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  await connectDB();
  const res = await SessionModel.deleteOne({ _id: sessionId, userId });
  /**
   * Through the SHARED helper, not a second copy of it.
   *
   * This file and the auth service each held their own `updateMany` for
   * “revoke this session’s chain”, and they had already drifted once: the auth
   * side went years without one at all, so every session it “killed” kept
   * rotating. A guard test even claimed the two were shared, and could not
   * fail for the fact that they were not.
   */
  if (res.deletedCount) await revokeRefreshTokensBySession(sessionId);
  return (res.deletedCount ?? 0) > 0;
}

/** Revoke all of a user's sessions except the one to keep ("log out everywhere"). */
export async function revokeOtherSessions(
  userId: string,
  keepSessionId: string | null,
): Promise<number> {
  await connectDB();
  const filter =
    keepSessionId != null
      ? { userId, _id: { $ne: keepSessionId } }
      : { userId };
  const sessions = (await SessionModel.find(filter)
    .select("_id")
    .lean()) as unknown as { _id: unknown }[];
  const ids = sessions.map((s) => String(s._id));
  if (ids.length === 0) return 0;

  await SessionModel.deleteMany({ _id: { $in: ids } });
await revokeRefreshTokensBySession(ids);
  return ids.length;
}
