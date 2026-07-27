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

export async function revokeRefreshToken(id: string) {
  await connectDB();
  return RefreshTokenModel.findByIdAndUpdate(id, { revokedAt: new Date() });
}

export async function revokeRefreshTokensByUser(userId: string) {
  await connectDB();
  return RefreshTokenModel.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
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
