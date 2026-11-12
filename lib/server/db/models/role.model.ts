import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";
import { defineModel } from "./_define-model";

/**
 * A role: a named bundle of permission ids from
 * features/team/lib/permissions.ts. Users reference it by `slug`.
 *
 * `isSystem` marks the five default roles (Owner, Manager, Kitchen Staff,
 * Delivery Staff, Content Editor). They cannot be deleted; the owner's
 * permissions cannot be changed at all, and are not even read — the owner holds
 * every permission by definition (see `permissionsForRole`).
 */
const roleSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  isSystem: { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
});

applyBaseTransform(roleSchema);

export type RoleDoc = InferSchemaType<typeof roleSchema>;

export const RoleModel: Model<RoleDoc> =
  defineModel<RoleDoc>("Role", roleSchema);
