/**
 * How the admin DRAWS a stock status: an English sentence fragment and a
 * shadcn Badge variant.
 *
 * These two used to sit in apps/admin/commerce/lib/inventory-utils.ts next to
 * the rule that derives the status. When that rule moved down to
 * features/inventory/lib/inventory-utils.ts — two server services were
 * importing it out of the admin app — these did not follow it. A badge colour
 * is not a business rule: "Low stock" is one shop's wording in one language,
 * and "warning" is the name of a class in this admin's design system. Their
 * only callers are the admin's stock badge and the admin's global search.
 */

import type { StockStatus } from "@/types/product";

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
