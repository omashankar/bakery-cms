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

/**
 * A zone save, with what the caller believed existed when it started.
 *
 * `knownIds` turns a blind replace-all into a diff: the server deletes only the
 * ids the caller HAD and no longer sends, and leaves anything created elsewhere
 * in the meantime alone. A bare array is still accepted — that is the shape an
 * older tab sends — and is treated as "delete nothing I have not seen", which is
 * the safe reading.
 */
export const deliveryZonesReplaceSchema = z.union([
  deliveryZonesArraySchema.transform((zones) => ({ zones, knownIds: null as string[] | null })),
  z.object({
    zones: deliveryZonesArraySchema,
    knownIds: z.array(z.string()),
  }),
]);
