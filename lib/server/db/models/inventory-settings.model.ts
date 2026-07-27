import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Inventory settings — a SINGLETON document. Small config that governs stock
 * derivation (default low-stock threshold) and whether adjustments are logged.
 */
const inventorySettingsSchema = new mongoose.Schema({
  key: { type: String, default: "singleton", unique: true, index: true },
  defaultLowStockThreshold: { type: Number, default: 10 },
  trackStockHistory: { type: Boolean, default: true },
});

applyBaseTransform(inventorySettingsSchema);

export type InventorySettingsDoc = InferSchemaType<typeof inventorySettingsSchema>;

export const InventorySettingsModel: Model<InventorySettingsDoc> =
  (mongoose.models.InventorySettings as Model<InventorySettingsDoc>) ||
  mongoose.model<InventorySettingsDoc>("InventorySettings", inventorySettingsSchema);
