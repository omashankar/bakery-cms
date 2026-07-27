import { z } from "zod";

/**
 * Zod contracts for coupons + delivery zones. The client persists whole
 * collections, so each write validates an array of items. Core fields strict,
 * timestamps/extras pass through.
 */

const couponSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().trim().min(1, "Code is required"),
    label: z.string().default(""),
    description: z.string().default(""),
    minSubtotal: z.number().min(0).optional(),
    percentOff: z.number().min(0).max(100).optional(),
    flatOff: z.number().min(0).optional(),
    isActive: z.boolean(),
    usageCount: z.number().min(0),
    createdAt: z.string(),
    expiresAt: z.string().optional(),
  })
  .passthrough();

const deliveryZoneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Name is required"),
    city: z.string().default(""),
    pincode: z.string().default(""),
    radiusKm: z.number().min(0),
    deliveryCharge: z.number().min(0),
    minDeliveryDays: z.number().int().min(0),
    estimatedDeliveryDays: z.number().int().min(0),
    isActive: z.boolean(),
    priority: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const couponsArraySchema = z.array(couponSchema);
export const deliveryZonesArraySchema = z.array(deliveryZoneSchema);
