import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";
import { defineModel } from "./_define-model";

/**
 * Admin/staff user. Storefront customers live in a separate `customers`
 * collection (Phase 8) — this collection is for people who sign in to /admin.
 */
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: { type: String, required: true },
  avatar: { type: String },
  // Role slug — references a document in the `roles` collection by `slug`.
  // String (not ObjectId) keeps it human-readable. NEVER read from the access
  // token to authorise: lib/server/auth/access.ts reads it from here, per
  // request, so a role change or a block takes effect at once.
  role: { type: String, required: true, default: "owner", index: true },
  /**
   * Only `active` may sign in or use the admin. `inactive` is "deactivated" — a
   * member on leave, say; `blocked` is a deliberate refusal. Both end every
   * session at once (see the team service).
   */
  status: {
    type: String,
    enum: ["active", "inactive", "blocked"],
    default: "active",
    index: true,
  },
  lastLoginAt: { type: Date },
  /** Who invited this member — a user id. Null for the first owner, made by the seed. */
  invitedBy: { type: String, default: null },
});

applyBaseTransform(userSchema, ["passwordHash"]);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const UserModel: Model<UserDoc> =
  defineModel<UserDoc>("User", userSchema);
