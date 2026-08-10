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
    /**
     * A real instant, or nothing.
     *
     * This was a bare string, and both expiry checks did
     * `new Date(value).getTime() < now` — which is `NaN < now`, i.e. false —
     * so a coupon stored with "31/12/2026" or "soon" was permanently live.
     * The endpoint takes the whole collection, so any client could set it.
     */
    expiresAt: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "Expiry must be a valid date",
      })
      .optional(),
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

/**
 * A coupon save, with what the caller believed existed when it started.
 *
 * Same shape and the same reason as the zones schema below — and coupons were
 * the one collection left without it. A blind replace-all asserts "these are all
 * the coupons there are", so a save from a tab opened before another admin
 * created a code silently deleted that code. Both admins were told it worked,
 * and a discount customers may already have been given stopped existing.
 *
 * A bare array is still accepted, and then nothing outside the incoming list is
 * touched, which is the safe reading.
 */
export const couponsReplaceSchema = z.union([
  couponsArraySchema.transform((coupons) => ({ coupons, knownIds: null as string[] | null })),
  z.object({
    coupons: couponsArraySchema,
    knownIds: z.array(z.string()),
  }),
]);
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
