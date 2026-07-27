import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

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
  // String (not ObjectId) keeps it human-readable and matches types/permissions.
  role: { type: String, required: true, default: "owner" },
  status: {
    type: String,
    enum: ["active", "inactive", "blocked"],
    default: "active",
  },
  lastLoginAt: { type: Date },
});

applyBaseTransform(userSchema, ["passwordHash"]);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const UserModel: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ||
  mongoose.model<UserDoc>("User", userSchema);
