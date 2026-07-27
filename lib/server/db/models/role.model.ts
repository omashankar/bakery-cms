import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Role + its permission scopes. Seeded from types/permissions.ts (Owner,
 * Store Manager, Content Editor, Viewer). `isSystem` roles cannot be deleted.
 * RBAC enforcement uses `permissions` (Phase 1 wires the base; UI comes later).
 */
const roleSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  isSystem: { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
});

applyBaseTransform(roleSchema);

export type RoleDoc = InferSchemaType<typeof roleSchema>;

export const RoleModel: Model<RoleDoc> =
  (mongoose.models.Role as Model<RoleDoc>) ||
  mongoose.model<RoleDoc>("Role", roleSchema);
