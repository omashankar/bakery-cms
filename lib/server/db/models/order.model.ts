import mongoose, { type Model } from "mongoose";

import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * Order document. `_id` is the app's own order id (a uuid/string), NOT an
 * ObjectId, so existing references keep working. `orderNumber` is uniquely
 * indexed (customer-facing tracking id). Rich nested shapes (items, totals,
 * address, coupon, deliverySlot, refundRecord) are stored as Mixed and validated
 * by Zod on write; status/paymentStatus are enums for queryability.
 */
const orderSchema = new mongoose.Schema(
  {
    _id: { type: String },
    orderNumber: { type: String, required: true, unique: true, index: true },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    totals: { type: mongoose.Schema.Types.Mixed, default: {} },
    address: { type: mongoose.Schema.Types.Mixed, default: {} },
    paymentMethod: { type: String, enum: ["cod", "upi", "card", "razorpay"], required: true },
    paymentStatus: {
      type: String,
      enum: ["cod", "paid", "pending", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    // Indexed because the "one payment, one order" guard queries it on every
    // placement. Sparse, not unique: COD orders have none, and a hard uniqueness
    // constraint here would turn a legitimate duplicate into a 500 rather than
    // letting the service return the order that already exists.
    paymentReference: { type: String, index: true, sparse: true },
    coupon: { type: mongoose.Schema.Types.Mixed },
    orderNotes: { type: String },
    placedAt: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "confirmed",
      index: true,
    },
    statusHistory: {
      type: [new mongoose.Schema({ status: String, at: String }, { _id: false })],
      default: [],
    },
    estimatedDelivery: { type: String, default: "" },
    deliverySlot: { type: mongoose.Schema.Types.Mixed },
    adminNotes: { type: String },
    cancellationReason: { type: String },
    refundReference: { type: String },
    refundRecord: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { minimize: false },
);

// The admin list sorts by placedAt and pages through it; without this index that
// is a full collection scan plus an in-memory sort on every request.
orderSchema.index({ placedAt: -1 });

orderSchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type OrderDoc = { _id: string } & Omit<PlacedOrder, "id">;

export const OrderModel: Model<OrderDoc> =
  (mongoose.models.Order as Model<OrderDoc>) ||
  mongoose.model<OrderDoc>("Order", orderSchema);
