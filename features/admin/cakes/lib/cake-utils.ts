import type { EntityStatus } from "@/types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatStatusLabel(status: EntityStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export type CakeFlagFilter = "all" | "featured" | "trending" | "best-seller";
export type ProductTypeFilter = "all" | "eggless" | "photo" | "seasonal";
export type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock" | "unlimited";

export interface CakeListFilters {
  search: string;
  categoryId: string;
  status: EntityStatus | "all";
  flag: CakeFlagFilter;
  productType: ProductTypeFilter;
  stock: StockFilter;
  sort: "name" | "price-asc" | "price-desc" | "updated";
}

export const defaultCakeListFilters: CakeListFilters = {
  search: "",
  categoryId: "all",
  status: "all",
  flag: "all",
  productType: "all",
  stock: "all",
  sort: "updated",
};

export function countActiveCakeFilters(filters: CakeListFilters): number {
  let count = 0;
  if (filters.productType !== "all") count += 1;
  if (filters.sort !== "updated") count += 1;
  return count;
}
