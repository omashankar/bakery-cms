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

applyBaseTransform(auditLogSchema);

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel: Model<AuditLogDoc> =
  (mongoose.models.AuditLog as Model<AuditLogDoc>) ||
  mongoose.model<AuditLogDoc>("AuditLog", auditLogSchema);
