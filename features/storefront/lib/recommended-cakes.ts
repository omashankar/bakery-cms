import type { LandingCake } from "@/constants/landing-data";
import { featuredCakes } from "@/constants/landing-data";
import { getAllCakes } from "@/features/storefront/lib/catalog";
import { getFrequentlyOrderedSlugs } from "@/features/storefront/lib/reorder";
import { getRecentlyViewedSlugs } from "@/features/storefront/lib/recently-viewed";

export function getRecommendedCakes(options?: {
  limit?: number;
  excludeSlug?: string;
}): LandingCake[] {
  const limit = options?.limit ?? 4;
  const excludeSlug = options?.excludeSlug;
  const cakesBySlug = new Map(getAllCakes().map((cake) => [cake.slug, cake]));
  const seen = new Set<string>();
  const recommended: LandingCake[] = [];

  function pushSlug(slug: string) {
    if (excludeSlug && slug === excludeSlug) return;
    if (seen.has(slug)) return;
    const cake = cakesBySlug.get(slug);
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

  for (const cake of featuredCakes) {
    pushSlug(cake.slug);
    if (recommended.length >= limit) return recommended;
  }

  for (const cake of cakesBySlug.values()) {
    pushSlug(cake.slug);
    if (recommended.length >= limit) return recommended;
  }

  return recommended;
}
