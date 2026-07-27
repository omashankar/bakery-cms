import mongoose, { type Model } from "mongoose";

import type { DeliveryZone } from "@/types/delivery";

/**
 * Delivery zone document. `_id` is the app's zone id. Determines delivery
 * charge + estimated days per city/pincode; higher `priority` wins on overlap.
 */
const deliveryZoneSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    city: { type: String, default: "" },
    pincode: { type: String, default: "" },
    radiusKm: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    minDeliveryDays: { type: Number, default: 0 },
    estimatedDeliveryDays: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 50 },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { minimize: false },
);

deliveryZoneSchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type DeliveryZoneDoc = { _id: string } & Omit<DeliveryZone, "id">;

export const DeliveryZoneModel: Model<DeliveryZoneDoc> =
  (mongoose.models.DeliveryZone as Model<DeliveryZoneDoc>) ||
  mongoose.model<DeliveryZoneDoc>("DeliveryZone", deliveryZoneSchema);
