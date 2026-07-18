import { getAllProducts } from "@/features/products/lib/product-catalog";
import type { LandingProduct } from "@/constants/landing-data";

const STORAGE_KEY = "bakery-cms-recently-viewed";
const MAX_ITEMS = 8;

export const RECENTLY_VIEWED_UPDATED_EVENT = "bakery-recently-viewed-updated";

function notifyUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECENTLY_VIEWED_UPDATED_EVENT));
}

function readSlugs(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSlugs(slugs: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs.slice(0, MAX_ITEMS)));
  notifyUpdated();
}

export function recordRecentlyViewedProduct(slug: string): void {
  const normalized = slug.trim();
  if (!normalized) return;

  const current = readSlugs().filter((item) => item !== normalized);
  writeSlugs([normalized, ...current]);
}

export function getRecentlyViewedSlugs(): string[] {
  return readSlugs();
}

export function getRecentlyViewedProducts(excludeSlug?: string): LandingProduct[] {
  const productsBySlug = new Map(getAllProducts().map((cake) => [cake.slug, cake]));

  return readSlugs()
    .filter((slug) => slug !== excludeSlug)
    .map((slug) => productsBySlug.get(slug))
    .filter((cake): cake is LandingProduct => Boolean(cake))
    .slice(0, MAX_ITEMS);
}
