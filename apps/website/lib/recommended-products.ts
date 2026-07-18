import type { LandingProduct } from "@/constants/landing-data";
import { featuredProducts } from "@/constants/landing-data";
import { getAllProducts } from "@/features/products/lib/product-catalog";
import { getFrequentlyOrderedSlugs } from "@/apps/website/lib/reorder";
import { getRecentlyViewedSlugs } from "@/apps/website/lib/recently-viewed";

export function getRecommendedProducts(options?: {
  limit?: number;
  excludeSlug?: string;
  excludeSlugs?: string[];
  /**
   * Catalogue to recommend from. Server-rendered pages pass the catalogue they
   * already fetched; client-only callers omit it and fall back to the browser
   * store. The ranking signals (recently viewed, frequently ordered) are
   * genuinely browser-local and always come from the client.
   */
  catalog?: LandingProduct[];
}): LandingProduct[] {
  const limit = options?.limit ?? 4;
  const excluded = new Set(options?.excludeSlugs ?? []);
  if (options?.excludeSlug) excluded.add(options.excludeSlug);
  const source = options?.catalog ?? getAllProducts();
  const productsBySlug = new Map(source.map((cake) => [cake.slug, cake]));
  const seen = new Set<string>();
  const recommended: LandingProduct[] = [];

  function pushSlug(slug: string) {
    if (excluded.has(slug)) return;
    if (seen.has(slug)) return;
    const cake = productsBySlug.get(slug);
    if (!cake || cake.inStock === false) return;
    seen.add(slug);
    recommended.push(cake);
  }

  for (const slug of getRecentlyViewedSlugs()) {
    pushSlug(slug);
    if (recommended.length >= limit) return recommended;
  }

  for (const slug of getFrequentlyOrderedSlugs(limit)) {
    pushSlug(slug);
    if (recommended.length >= limit) return recommended;
  }

  for (const cake of featuredProducts) {
    pushSlug(cake.slug);
    if (recommended.length >= limit) return recommended;
  }

  for (const cake of productsBySlug.values()) {
    pushSlug(cake.slug);
    if (recommended.length >= limit) return recommended;
  }

  return recommended;
}
