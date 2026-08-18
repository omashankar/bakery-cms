import { connectDB } from "@/lib/server/db/mongoose";
import { UserModel } from "@/lib/server/db/models/user.model";
import { SessionModel } from "@/lib/server/db/models/session.model";
import { RefreshTokenModel } from "@/lib/server/db/models/refresh-token.model";
import { PasswordResetModel } from "@/lib/server/db/models/password-reset.model";

/**
 * Auth repository — the ONLY place that touches auth collections directly.
 * Returns lean/document data; all business rules live in the service.
 */

// ---- Users ----------------------------------------------------------------

export async function findUserByEmail(email: string) {
  await connectDB();
  return UserModel.findOne({ email: email.toLowerCase().trim() });
}

export async function findUserById(id: string) {
  await connectDB();
  return UserModel.findById(id);
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await connectDB();
  return UserModel.findByIdAndUpdate(userId, { passwordHash }, { new: true });
}

export async function touchLastLogin(userId: string) {
  await connectDB();
  return UserModel.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
}

// ---- Sessions -------------------------------------------------------------

export async function createSession(input: {
  userId: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
}) {
  await connectDB();
  return SessionModel.create(input);
}

/**
 * The session row, for the idle-timeout check on refresh.
 *
 * `lastSeenAt` is what makes the shop's configured "session timeout" mean
 * something. The access token cannot express it — it is unrevocable for its
 * lifetime, so it is deliberately kept short — and a cookie expiry only governs
 * a browser that cooperates.
 */
export async function findSessionById(sessionId: string) {
  await connectDB();
  return SessionModel.findById(sessionId);
}

/** Marks the session as used, restarting the idle window. */
export async function touchSession(sessionId: string) {
  await connectDB();
  return SessionModel.findByIdAndUpdate(sessionId, { $set: { lastSeenAt: new Date() } });
}

export async function deleteSession(sessionId: string) {
  await connectDB();
  return SessionModel.findByIdAndDelete(sessionId);
}

export async function deleteSessionsByUser(userId: string) {
  await connectDB();
  return SessionModel.deleteMany({ userId });
}

// ---- Refresh tokens -------------------------------------------------------

export async function createRefreshToken(input: {
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await connectDB();
  return RefreshTokenModel.create(input);
}

export async function findActiveRefreshToken(tokenHash: string) {
  await connectDB();
  return RefreshTokenModel.findOne({ tokenHash, revokedAt: null });
}

/**
 * A token by hash, REVOKED OR NOT.
 *
 * `findActiveRefreshToken` answers null for a token that was rotated a moment
 * ago and for one that never existed, and those need opposite treatment: the
 * first is a second tab that lost a harmless race, the second is a replay.
 * Telling them apart needs the revoked row itself.
 */
export async function findRefreshToken(tokenHash: string) {
  await connectDB();
  return RefreshTokenModel.findOne({ tokenHash });
}

export async function revokeRefreshToken(id: string) {
  await connectDB();
  return RefreshTokenModel.findByIdAndUpdate(id, { revokedAt: new Date() });
}

export async function revokeRefreshTokensByUser(userId: string) {
  await connectDB();
  return RefreshTokenModel.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

/**
 * Revoke every token in ONE session's chain.
 *
 * Deleting the session row does not end the session: a refresh token names its
 * session but is not stored inside it, so a chain whose row is gone keeps
 * rotating — and `security.repository.revokeSession` has always known that,
 * doing exactly this alongside its delete. The auth service did not, so every
 * "kill the whole session" it performed left the live token untouched.
 */
export async function revokeRefreshTokensBySession(sessionId: string) {
  await connectDB();
  return RefreshTokenModel.updateMany({ sessionId, revokedAt: null }, { revokedAt: new Date() });
}

// ---- Password reset (OTP) -------------------------------------------------

export async function createPasswordReset(input: {
  email: string;
  otpHash: string;
  expiresAt: Date;
}) {
  await connectDB();
  return PasswordResetModel.create(input);
}

export async function findActiveReset(email: string) {
  await connectDB();
  // Most recent unused, unexpired OTP for this email.
  return PasswordResetModel.findOne({
    email: email.toLowerCase().trim(),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
}

export async function incrementResetAttempts(id: string) {
  await connectDB();
  return PasswordResetModel.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { new: true });
}

export async function markResetUsed(id: string) {
  await connectDB();
  return PasswordResetModel.findByIdAndUpdate(id, { usedAt: new Date() });
}
