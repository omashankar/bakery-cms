import { connectDB } from "@/lib/server/db/mongoose";
import { StockHistoryModel } from "@/lib/server/db/models/stock-history.model";
import { InventorySettingsModel } from "@/lib/server/db/models/inventory-settings.model";

/** Inventory repository — stock history + inventory settings singleton. */

const SINGLETON = "singleton";
const MAX_HISTORY = 500;

export async function appendHistory(entry: {
  cakeId: string;
  cakeName: string;
  adjustmentType: "add" | "remove" | "set";
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  reason: "manual_adjustment" | "restock" | "correction" | "sale" | "return";
  note?: string;
}) {
  await connectDB();
  return StockHistoryModel.create(entry);
}

export async function listHistory(cakeId?: string) {
  await connectDB();
  const filter = cakeId ? { cakeId } : {};
  const docs = await StockHistoryModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY)
    .lean();
  return docs.map((d) => {
    const { _id, __v, ...rest } = d as Record<string, unknown>;
    void __v;
    return { ...rest, id: String(_id) };
  });
}

export async function getOrCreateSettings() {
  await connectDB();
  const existing = await InventorySettingsModel.findOne({ key: SINGLETON });
  if (existing) return existing;
  return InventorySettingsModel.create({ key: SINGLETON });
}

export async function updateSettings(fields: {
  defaultLowStockThreshold: number;
  trackStockHistory: boolean;
}) {
  const doc = await getOrCreateSettings();
  doc.set(fields);
  await doc.save();
  return doc;
}
