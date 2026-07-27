import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Admin-managed customer metadata, keyed by email. The customer record itself
 * (name, order count, spend, addresses, activity) is DERIVED from orders — this
 * collection only stores the bits an admin sets: tags, notes, marketing opt-in
 * and a blocked flag. `email` is the unique key.
 */
const customerMetaSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  tags: { type: [String], default: [] },
  notes: { type: String, default: "" },
  marketingOptIn: { type: Boolean, default: true },
  blocked: { type: Boolean, default: false },
});

applyBaseTransform(customerMetaSchema);

export type CustomerMetaDoc = InferSchemaType<typeof customerMetaSchema>;

export const CustomerMetaModel: Model<CustomerMetaDoc> =
  (mongoose.models.CustomerMeta as Model<CustomerMetaDoc>) ||
  mongoose.model<CustomerMetaDoc>("CustomerMeta", customerMetaSchema);
