import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";
import { defineModel } from "./_define-model";

/**
 * An invitation to join the admin team.
 *
 * Only a SHA-256 of the link's token is stored, the way password-reset codes
 * are: someone who can read this collection cannot sign up as the invitee.
 * Single use is enforced by the accept step claiming the row atomically
 * (`status: "pending"` → `"accepted"` in one update), not by deleting it.
 *
 * Kept after it is used, revoked or lapses — no TTL — because the Team screen
 * shows who invited whom and when, and the audit log points at these ids.
 * "Expired" is not stored: a pending invitation past `expiresAt` IS expired.
 */
const teamInvitationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  /** Role slug, as on the user. */
  role: { type: String, required: true },
  message: { type: String, default: "" },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "revoked"],
    default: "pending",
    index: true,
  },
  invitedBy: { type: String, default: null },
  invitedByEmail: { type: String, default: "" },
  sentCount: { type: Number, default: 1 },
  lastSentAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  acceptedUserId: { type: String, default: null },
  revokedAt: { type: Date, default: null },
});

/**
 * One OPEN invitation per address. A second "Invite" for the same email is a
 * resend, not a second link that might be accepted after the first was revoked.
 */
teamInvitationSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_per_email" },
);

applyBaseTransform(teamInvitationSchema, ["tokenHash"]);

export type TeamInvitationDoc = InferSchemaType<typeof teamInvitationSchema>;

export const TeamInvitationModel: Model<TeamInvitationDoc> =
  defineModel<TeamInvitationDoc>("TeamInvitation", teamInvitationSchema);
