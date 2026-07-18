import type { LandingProduct } from "@/constants/landing-data";
import type { Product } from "@/types/product";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
import { filterProductsByCategory } from "@/features/products/lib/product-catalog";

/**
 * Homepage rail selection.
 *
 * Product selection is domain logic, not storefront UI — it runs on the server
 * (from the server store) and in the browser (from the client cache), so it
 * lives here and takes its catalogue as an argument rather than reading one.
 */
export type HomepageProductSource =
  | "featured"
  | "trending"
  | "best-sellers"
  | "photo-cakes"
  | "eggless"
  | "seasonal";

function mergeWithCatalog(adminCakes: LandingProduct[], fallback: LandingProduct[]): LandingProduct[] {
  if (adminCakes.length === 0) return fallback;
  const slugs = new Set(adminCakes.map((cake) => cake.slug));
  const extras = fallback.filter((cake) => !slugs.has(cake.slug));
  return [...adminCakes, ...extras];
}

/**
 * Pure rail builder.
 *
 * Takes the catalogue rather than reading it, so the same selection logic runs
 * on the server (where products come from the server store) and in the browser.
 */
export function buildHomepageProducts(
  source: HomepageProductSource,
  maxCount: number,
  adminProducts: Product[],
  all: LandingProduct[]
): LandingProduct[] {
  const published = adminProducts.filter((cake) => cake.status === "published");
  const flags = {
    featured: published.filter((cake) => cake.isFeatured),
    trending: published.filter((cake) => cake.isTrending),
    bestSellers: published.filter((cake) => cake.isBestSeller),
    photo: published.filter((cake) => cake.isPhotoCake),
    eggless: published.filter((cake) => cake.isEggless),
    seasonal: published.filter((cake) => cake.isSeasonal),
  };

  const adminMapped = getPublishedStorefrontProducts(adminProducts);
  const adminBySlug = new Map(adminMapped.map((cake) => [cake.slug, cake]));

  const pickAdmin = (cakes: Product[]) =>
    cakes.map((cake) => adminBySlug.get(cake.slug)).filter((cake): cake is LandingProduct => Boolean(cake));

  const sourceMatchers: Record<HomepageProductSource, () => LandingProduct[]> = {
    featured: () => {
      const admin = pickAdmin(flags.featured);
      return mergeWithCatalog(admin, all.filter((cake) => cake.badge === "Featured"));
    },
    trending: () => {
      const admin = pickAdmin(flags.trending);
      return mergeWithCatalog(admin, all.filter((cake) => cake.badge === "Trending"));
    },
    "best-sellers": () => {
      const admin = pickAdmin(flags.bestSellers);
      return mergeWithCatalog(admin, all.filter((cake) => cake.badge === "Bestseller"));
    },
    "photo-cakes": () => {
      const admin = pickAdmin(flags.photo);
      return mergeWithCatalog(admin, filterProductsByCategory(all, "photo-cakes"));
    },
    eggless: () => {
      const admin = pickAdmin(flags.eggless);
      return mergeWithCatalog(admin, filterProductsByCategory(all, "eggless"));
    },
    seasonal: () => {
      const admin = pickAdmin(flags.seasonal);
      return mergeWithCatalog(admin, filterProductsByCategory(all, "seasonal"));
    },
  };

  const matched = sourceMatchers[source]();
  if (matched.length >= maxCount) return matched.slice(0, maxCount);

  // Keep grids full even when few cakes carry a given flag — relevant ones first,
  // then top up from the wider catalogue so a section never shows a lone card.
  const seen = new Set(matched.map((cake) => cake.slug));
  const extras = all.filter((cake) => !seen.has(cake.slug));

  // Rotate the top-up pool per source so adjacent sections don't repeat the same cakes.
  const sourceOrder: HomepageProductSource[] = [
    "featured",
    "trending",
    "best-sellers",
    "photo-cakes",
    "eggless",
    "seasonal",
  ];
  const offset = extras.length
    ? (Math.max(0, sourceOrder.indexOf(source)) * 4) % extras.length
    : 0;
  const rotated = [...extras.slice(offset), ...extras.slice(0, offset)];

  return [...matched, ...rotated].slice(0, maxCount);
}

