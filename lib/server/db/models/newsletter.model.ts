import mongoose, { type Model } from "mongoose";

import type { NewsletterSubscriber } from "@/types/inquiry";

/**
 * Newsletter subscriber. `_id` is the app's own id (string). `email` is uniquely
 * indexed (lowercased) so re-subscribing dedupes. Created by the public
 * subscribe form and managed by the admin (activate/deactivate/delete).
 */
const newsletterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    email: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true },
    source: { type: String, default: "Website" },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { minimize: false },
);

newsletterSchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

// Same reasoning as inquiries: read newest-first, one row per subscriber, and
// unbounded. `email` is unique-indexed but says nothing about order.
newsletterSchema.index({ createdAt: -1 });

export type NewsletterDoc = { _id: string } & Omit<NewsletterSubscriber, "id">;

export const NewsletterModel: Model<NewsletterDoc> =
  (mongoose.models.Newsletter as Model<NewsletterDoc>) ||
  mongoose.model<NewsletterDoc>("Newsletter", newsletterSchema);
