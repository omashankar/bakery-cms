import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Audit trail for every meaningful admin action (login, logout, create, update,
 * delete, refund, inventory change, payment update). Append-only — never edited.
 */
const auditLogSchema = new mongoose.Schema({
  // Who — null for anonymous/failed-login attempts.
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  actorEmail: { type: String, default: "" },
  // What — e.g. "auth.login", "product.update", "order.refund".
  action: { type: String, required: true, index: true },
  // Which entity — e.g. { type: "product", id: "..." }.
  target: {
    type: { type: String, default: "" },
    id: { type: String, default: "" },
  },
  // Free-form context (diffs, reason, amounts). Kept small.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  status: { type: String, enum: ["success", "failure"], default: "success" },
});

/**
 * The Activity screen and the Security Center both page through this newest
 * first, and neither `actorId` nor `action` helps with that — so every view of
 * either screen was a COLLSCAN plus an in-memory sort of the WHOLE trail to
 * hand back twenty rows (measured: 447 examined, 20 returned).
 *
 * This is the one collection here that grows without any bound at all: every
 * meaningful admin action appends a row and nothing ever removes one. An
 * in-memory sort is also capped at 32MB, so left alone this does not merely
 * get slower — past that mark the query starts failing outright.
 */
auditLogSchema.index({ createdAt: -1 });

applyBaseTransform(auditLogSchema);

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel: Model<AuditLogDoc> =
  (mongoose.models.AuditLog as Model<AuditLogDoc>) ||
  mongoose.model<AuditLogDoc>("AuditLog", auditLogSchema);
