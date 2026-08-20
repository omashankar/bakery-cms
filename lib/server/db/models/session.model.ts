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

/**
 * The Security Center lists one admin’s own devices, newest-seen first.
 * `userId` alone already narrows the match, but the ordering was still done in
 * memory afterwards — and a row exists per login, so this list grows for as
 * long as an admin keeps signing in (55 rows for the single admin here).
 *
 * The standalone `userId` index above is now a prefix of this one and could be
 * dropped; left in place deliberately, because removing an index is a separate
 * decision from adding one.
 */
sessionSchema.index({ userId: 1, lastSeenAt: -1 });

applyBaseTransform(sessionSchema);

export type SessionDoc = InferSchemaType<typeof sessionSchema>;

export const SessionModel: Model<SessionDoc> =
  (mongoose.models.Session as Model<SessionDoc>) ||
  mongoose.model<SessionDoc>("Session", sessionSchema);
