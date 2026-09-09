import type { EntityStatus } from "@/types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * An address for a name that has no Latin letters in it.
 *
 * `slugify` keeps only [a-z0-9], so a product named entirely in Devanagari —
 * मनी प्लांट — or in Tamil, or in Chinese, slugifies to the empty string. The
 * form fills this box from the name and the save then refuses a blank slug, so
 * a shop typing in its own language was blocked on a field it had never touched
 * and could not see the problem with. This CMS is sold to Indian shop owners.
 *
 * Percent-encoding is what a browser does with those characters anyway, and a
 * URL carrying them is perfectly valid — but it is unreadable in an address bar
 * and unusable in a WhatsApp message, which is where this shop's links live. So
 * the fallback is not the name: it is a short readable stand-in the shop can
 * overwrite with anything it likes.
 *
 * Deterministic, so the same name gives the same address on every machine and
 * two people typing the same product do not create two rows.
 */
export function slugOrFallback(value: string, fallback = "item"): string {
  const slug = slugify(value);
  if (slug) return slug;

  const trimmed = value.trim();
  if (!trimmed) return "";

  // A stable short digest of the shop's own characters, so "मनी प्लांट" and
  // "गुलाब" do not both become "item".
  let hash = 0;
  for (const char of trimmed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return `${fallback}-${hash.toString(36).slice(0, 6)}`;
}

export function formatStatusLabel(status: EntityStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export type ProductFlagFilter = "all" | "featured" | "trending" | "best-seller";
export type ProductTypeFilter = "all" | "photo";
export type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock" | "unlimited";

export interface ProductListFilters {
  search: string;
  categoryId: string;
  status: EntityStatus | "all";
  flag: ProductFlagFilter;
  productType: ProductTypeFilter;
  stock: StockFilter;
  sort: "name" | "price-asc" | "price-desc" | "updated";
}

export const defaultProductListFilters: ProductListFilters = {
  search: "",
  categoryId: "all",
  status: "all",
  flag: "all",
  productType: "all",
  stock: "all",
  sort: "updated",
};

export function countActiveProductFilters(filters: ProductListFilters): number {
  let count = 0;
  if (filters.productType !== "all") count += 1;
  if (filters.sort !== "updated") count += 1;
  return count;
}
