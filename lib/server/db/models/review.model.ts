import mongoose, { type Model } from "mongoose";

import type { ProductReview } from "@/types/review";

/**
 * Product review. `_id` is the app's own id (string). `productSlug` and `status`
 * are indexed (storefront reads approved-by-product; admin moderates by status).
 * Created by the public review form (status "pending") and moderated by the admin.
 */
const reviewSchema = new mongoose.Schema(
  {
    _id: { type: String },
    cakeId: { type: String, default: "" },
    productSlug: { type: String, required: true, index: true },
    cakeName: { type: String, default: "" },
    authorName: { type: String, required: true },
    authorEmail: { type: String },
    rating: { type: Number, required: true },
    title: { type: String },
    body: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "reported"],
      default: "pending",
      index: true,
    },
    isFeatured: { type: Boolean, default: false },
    adminReply: { type: String },
    repliedAt: { type: String },
    reportReason: { type: String },
    orderNumber: { type: String },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { minimize: false },
);

reviewSchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type ReviewDoc = { _id: string } & Omit<ProductReview, "id">;

export const ReviewModel: Model<ReviewDoc> =
  (mongoose.models.Review as Model<ReviewDoc>) ||
  mongoose.model<ReviewDoc>("Review", reviewSchema);
