import mongoose, { type Model } from "mongoose";

import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";

/**
 * Coupon document. `_id` is the app's coupon id (uuid string), `code` is a
 * unique index. Amounts/limits (percentOff/flatOff/minSubtotal/expiresAt) are
 * validated by Zod on write.
 */
const couponSchema = new mongoose.Schema(
  {
    _id: { type: String },
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    label: { type: String, default: "" },
    description: { type: String, default: "" },
    minSubtotal: { type: Number },
    percentOff: { type: Number },
    flatOff: { type: Number },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    createdAt: { type: String },
    expiresAt: { type: String },
  },
  { minimize: false },
);

couponSchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type CouponDoc = { _id: string } & Omit<StoredCoupon, "id">;

export const CouponModel: Model<CouponDoc> =
  (mongoose.models.Coupon as Model<CouponDoc>) ||
  mongoose.model<CouponDoc>("Coupon", couponSchema);
