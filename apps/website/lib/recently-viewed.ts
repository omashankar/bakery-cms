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

/**
 * The cakes this browser has looked at, resolved against the SHOP's catalogue.
 *
 * `catalogue` is a required argument on purpose, exactly as `reorderFromOrder`
 * was changed to require one. This called `getAllProducts()`, which merges the
 * shipped demo constants with `loadProducts()` — the ADMIN's localStorage
 * cache, seeded with those same demo cakes and never populated in a customer's
 * browser, because `useProductCacheSync` runs only in the admin layout.
 *
 * So a customer who viewed a cake the shop had created found it missing from
 * the rail, while a slug that happened to match a demo cake rendered the DEMO
 * record — old price, old image — and `ProductCard`'s Add to Cart wrote that
 * stale price into the cart line, which checkout then rejected with "Prices
 * have changed".
 */
export function getRecentlyViewedProducts(
  catalogue: LandingProduct[],
  excludeSlug?: string,
): LandingProduct[] {
  const productsBySlug = new Map(catalogue.map((cake) => [cake.slug, cake]));

  return readSlugs()
    .filter((slug) => slug !== excludeSlug)
    .map((slug) => productsBySlug.get(slug))
    .filter((cake): cake is LandingProduct => Boolean(cake))
    .slice(0, MAX_ITEMS);
}
