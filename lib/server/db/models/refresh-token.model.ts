import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Refresh token record for rotation + revocation.
 *
 * We store only a SHA-256 hash of the token, never the token itself — a DB leak
 * must not hand out usable refresh tokens. On each refresh the old row is marked
 * `revokedAt` and a fresh one is issued (rotation). `sessionId` links the token
 * to its device session so logging out a session kills its refresh chain.
 */
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

// TTL index purges tokens after expiry (grace of 0s past expiresAt).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

applyBaseTransform(refreshTokenSchema, ["tokenHash"]);

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema>;

export const RefreshTokenModel: Model<RefreshTokenDoc> =
  (mongoose.models.RefreshToken as Model<RefreshTokenDoc>) ||
  mongoose.model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
