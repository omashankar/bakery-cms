import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * A signed-in device/session. One row per active login, so an admin can review
 * active sessions and "log out everywhere". `expiresAt` has a TTL index — Mongo
 * auto-removes expired sessions.
 */
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userAgent: { type: String, default: "" },
  ip: { type: String, default: "" },
  lastSeenAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
});

// TTL index: Mongo purges the document once expiresAt passes.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

applyBaseTransform(sessionSchema);

export type SessionDoc = InferSchemaType<typeof sessionSchema>;

export const SessionModel: Model<SessionDoc> =
  (mongoose.models.Session as Model<SessionDoc>) ||
  mongoose.model<SessionDoc>("Session", sessionSchema);
