import { z } from "zod";

/** Zod contracts for inventory operations. */

export const adjustStockSchema = z.object({
  cakeId: z.string().min(1, "Product id is required"),
  type: z.enum(["add", "remove", "set"]),
  // Whole cakes. A fractional quantity was accepted and stored, producing a
  // stock level of 4.5 that no badge, filter or oversell check treats as a
  // sellable count — and `{ $gte: quantity }` on order placement then refused a
  // sale the shop could actually fulfil.
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(1_000_000, "Quantity is too large"),
  reason: z
    .enum(["manual_adjustment", "restock", "correction", "sale", "return"])
    .optional()
    .default("manual_adjustment"),
  note: z.string().trim().optional(),
});

export const setUnlimitedSchema = z.object({
  cakeId: z.string().min(1, "Product id is required"),
  unlimited: z.boolean(),
});

export const inventorySettingsSchema = z.object({
  defaultLowStockThreshold: z.number().int().min(0).max(100000),
  trackStockHistory: z.boolean(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type SetUnlimitedInput = z.infer<typeof setUnlimitedSchema>;
export type InventorySettingsInput = z.infer<typeof inventorySettingsSchema>;
