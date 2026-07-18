import type { ProductFormData } from "@/types";
import type { StockStatus } from "@/types/product";
import type { InventorySettings } from "@/types/inventory";

const FALLBACK_SETTINGS: InventorySettings = {
  defaultLowStockThreshold: 10,
  trackStockHistory: true,
};

export function getLowStockThreshold(
  cake: Pick<ProductFormData, "lowStockThreshold">,
  settings: InventorySettings = FALLBACK_SETTINGS
): number {
  return cake.lowStockThreshold ?? settings.defaultLowStockThreshold;
}

export function deriveStockStatus(
  cake: Pick<ProductFormData, "stockQuantity" | "unlimitedStock" | "lowStockThreshold">,
  settings: InventorySettings = FALLBACK_SETTINGS
): StockStatus {
  if (cake.unlimitedStock) return "in_stock";
  if ((cake.stockQuantity ?? 0) <= 0) return "out_of_stock";
  const threshold = getLowStockThreshold(cake, settings);
  if ((cake.stockQuantity ?? 0) <= threshold) return "low_stock";
  return "in_stock";
}

export function resolveStockFields(
  data: Pick<ProductFormData, "stockQuantity" | "unlimitedStock" | "lowStockThreshold" | "stockStatus">
): Pick<ProductFormData, "stockQuantity" | "unlimitedStock" | "lowStockThreshold" | "stockStatus"> {
  const unlimitedStock = data.unlimitedStock ?? false;
  const stockQuantity = Math.max(data.stockQuantity ?? 0, 0);
  const stockStatus = deriveStockStatus({
    stockQuantity,
    unlimitedStock,
    lowStockThreshold: data.lowStockThreshold,
  });

  return {
    stockQuantity,
    unlimitedStock,
    lowStockThreshold: data.lowStockThreshold,
    stockStatus,
  };
}

export function formatStockStatusLabel(status: StockStatus): string {
  if (status === "in_stock") return "In stock";
  if (status === "low_stock") return "Low stock";
  return "Out of stock";
}

export function getStockStatusVariant(
  status: StockStatus
): "success" | "warning" | "destructive" {
  if (status === "in_stock") return "success";
  if (status === "low_stock") return "warning";
  return "destructive";
}
