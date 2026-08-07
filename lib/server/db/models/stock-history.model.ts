import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Stock adjustment audit trail — one row per stock change (manual adjustment,
 * restock, correction, sale, return). Append-only; drives the inventory History
 * view. `cakeId` references a product's string id.
 */
const stockHistorySchema = new mongoose.Schema({
  cakeId: { type: String, required: true, index: true },
  cakeName: { type: String, default: "" },
  adjustmentType: { type: String, enum: ["add", "remove", "set"], required: true },
  quantityBefore: { type: Number, required: true },
  quantityChange: { type: Number, required: true },
  quantityAfter: { type: Number, required: true },
  reason: {
    type: String,
    enum: ["manual_adjustment", "restock", "correction", "sale", "return"],
    default: "manual_adjustment",
  },
  note: { type: String },
});

applyBaseTransform(stockHistorySchema);

// `listHistory` sorts by createdAt and pages through it — for one cake, or for
// the whole shop. Without these the History view is a full collection scan plus
// an in-memory sort on every admin load, and this table only ever grows.
stockHistorySchema.index({ createdAt: -1 });
stockHistorySchema.index({ cakeId: 1, createdAt: -1 });

export type StockHistoryDoc = InferSchemaType<typeof stockHistorySchema>;

export const StockHistoryModel: Model<StockHistoryDoc> =
  (mongoose.models.StockHistory as Model<StockHistoryDoc>) ||
  mongoose.model<StockHistoryDoc>("StockHistory", stockHistorySchema);
