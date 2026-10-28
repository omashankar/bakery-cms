import mongoose, { type Model } from "mongoose";

import type { DeliveryZone } from "@/types/delivery";
import { defineModel } from "./_define-model";

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
    // What the zone covers; absent on zones written before it existed, which
    // keep their single city/pincode rule. See `DeliveryZoneCoverage`.
    coverage: { type: String, enum: ["country", "states", "cities", "pincodes", "radius", "polygon", "areas"] },
    states: { type: [String], default: undefined },
    cities: { type: [String], default: undefined },
    pincodes: { type: [String], default: undefined },
    excludedPincodes: { type: [String], default: undefined },
    // The map area: a circle round `center`, or a drawn boundary. `_id: false`
    // so a corner is a point, not a document.
    center: {
      type: new mongoose.Schema({ lat: Number, lng: Number }, { _id: false }),
      default: undefined,
    },
    polygon: {
      type: [new mongoose.Schema({ lat: Number, lng: Number }, { _id: false })],
      default: undefined,
    },
    // Several circles and boundaries in one zone (coverage "areas").
    areas: {
      type: [
        new mongoose.Schema(
          {
            kind: { type: String, enum: ["radius", "polygon"], required: true },
            center: { type: new mongoose.Schema({ lat: Number, lng: Number }, { _id: false }), default: undefined },
            radiusKm: { type: Number, default: undefined },
            polygon: { type: [new mongoose.Schema({ lat: Number, lng: Number }, { _id: false })], default: undefined },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
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
  defineModel<DeliveryZoneDoc>("DeliveryZone", deliveryZoneSchema);
