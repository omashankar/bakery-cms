/**
 * The rule that decides whether a product is in_stock, low_stock or
 * out_of_stock.
 *
 * This used to live at apps/admin/commerce/lib/inventory-utils.ts, because the
 * admin's inventory table was the first screen that needed to colour a row. But
 * the same rule is what the server enforces when a customer places an order, so
 * features/orders/server/order.service.ts and
 * features/inventory/server/inventory.service.ts both had to import an admin UI
 * module to work out whether a cake could be sold at all. A shop that never
 * loads the admin app still has to answer that question, and the domain layer
 * could not answer it without reaching up into apps/admin.
 *
 * Nothing here was ever admin-specific: it reads stockQuantity, unlimitedStock
 * and lowStockThreshold off a product, falls back to the shop's
 * InventorySettings, and imports nothing but types.
 *
 * The English label and the Badge colour that used to sit alongside these did
 * NOT come down; they are admin chrome and live in
 * apps/admin/commerce/lib/stock-status-presentation.ts.
 *
 * Deliberately carries no "use client" directive. Three admin client
 * components and two server services both call in here; a directive would
 * break the server callers.
 */

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
