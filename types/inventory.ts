import type { EntityStatus } from "./common";
import type { StockStatus } from "./product";

export interface InventorySettings {
  defaultLowStockThreshold: number;
  trackStockHistory: boolean;
}

export type StockAdjustmentType = "add" | "remove" | "set";

export type StockHistoryReason =
  | "manual_adjustment"
  | "restock"
  | "correction"
  | "sale"
  | "return";

export interface StockHistoryEntry {
  id: string;
  cakeId: string;
  cakeName: string;
  adjustmentType: StockAdjustmentType;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  reason: StockHistoryReason;
  note?: string;
  createdAt: string;
}

export interface InventoryItem {
  cakeId: string;
  name: string;
  slug: string;
  categoryName: string;
  image?: string;
  status: EntityStatus;
  stockStatus: StockStatus;
  stockQuantity: number;
  unlimitedStock: boolean;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface InventoryOverview {
  totalSkus: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  unlimited: number;
  alertCount: number;
  totalUnits: number;
}
