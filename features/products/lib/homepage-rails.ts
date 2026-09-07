import type { LandingProduct } from "@/constants/landing-data";
import type { Product } from "@/types/product";
import {
  getPublishedStorefrontProducts,
  type TaxonomyNames,
} from "@/features/products/lib/product-mapper";
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

/**
 * The rows whose heading is a claim about the product, not a curation.
 * See the note at the top-up below for why they are exempt from it.
 */
const UNPADDED_SOURCES: ReadonlySet<HomepageProductSource> = new Set([
  "eggless",
  "seasonal",
  "photo-cakes",
]);

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
  all: LandingProduct[],
  /**
   * Category and occasion names, for callers that have them.
   *
   * Without this the flagged cakes below — the ones the section is actually
   * about — resolved their category through `getCategoryById`, which on the
   * SERVER reads the shipped demo taxonomy because no client store has been
   * hydrated there. So the live homepage labelled a shop's own cakes with
   * category names out of the demo data, while the cakes topped up from `all`
   * (already mapped with names by the caller) were labelled correctly — two
   * different answers inside one row. The browser did not have the bug, which
   * is why it went unnoticed: there the store is real.
   */
  names?: TaxonomyNames,
  /**
   * The shop own categories, so a slug can be resolved to its NAME.
   *
   * `filterProductsByCategory` falls back to slugifying the product category
   * name, and that only works where a shop has not renamed a category away
   * from its slug. This shop has “Eggless Cakes” at /eggless, so the fallback
   * compares “eggless-cakes” with “eggless” and the row comes back empty.
   * Seasonal happened to work only because its name IS its slug.
   */
  categories?: { name: string; slug: string }[],
): LandingProduct[] {
  const published = adminProducts.filter((cake) => cake.status === "published");
  const flags = {
    featured: published.filter((cake) => cake.isFeatured),
    trending: published.filter((cake) => cake.isTrending),
    bestSellers: published.filter((cake) => cake.isBestSeller),
    photo: published.filter((cake) => cake.allowsPhotoUpload),
  };

  const adminMapped = getPublishedStorefrontProducts(adminProducts, names);
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

    /**
     * The CATEGORY, not a flag on the product.
     *
     * There was an `isSeasonal` tick, and it disagreed with the rest of the
     * site: the nav's “Seasonal” link and the mega-menu card both point at
     * `/collections/seasonal`, which is served by the category — so a cake
     * ticked Seasonal but filed under Birthday appeared in this row and was
     * missing from the page the row links to. Two answers to one question.
     *
     * One list now: put the product in the Seasonal category and every
     * surface agrees.
     */
    /**
     * Also the CATEGORY. `isEggless` was a boolean on the product, and a
     * claim about a RECIPE that the software derived from an option label;
     * it went with the egg special case. What a shop files under Eggless is
     * the shop saying so in its own catalogue, which is the same answer the
     * nav link and /collections/eggless already give.
     */
    eggless: () => {
      const admin = filterProductsByCategory(adminMapped, "eggless", categories);
      return mergeWithCatalog(
        admin,
        filterProductsByCategory(all, "eggless", categories),
      );
    },

    seasonal: () => {
      const admin = filterProductsByCategory(adminMapped, "seasonal", categories);
      return mergeWithCatalog(
        admin,
        filterProductsByCategory(all, "seasonal", categories),
      );
    },
  };

  const matched = sourceMatchers[source]();
  if (matched.length >= maxCount) return matched.slice(0, maxCount);

  /**
   * A row that says what its products ARE cannot be topped up.
   *
   * The padding below keeps a grid full when too few products match, which
   * is a fair display decision for a row the shop CURATES — Featured,
   * Trending, Best Sellers are its own selection, and a fourth cake beside
   * three chosen ones says nothing untrue about any of them.
   *
   * It is not fair for a row that names a property. “Eggless Collection”
   * padded with an ordinary sponge is not untidy, it is a false statement
   * about food; the eggless rail was removed rather than left to do exactly
   * that. “Photo Cakes” padded with a cake that takes no photograph sends
   * the customer to a page with no uploader on it, and “Seasonal” pads with
   * whatever is in stock. A shop with two eggless cakes has a row of two.
   */
  if (UNPADDED_SOURCES.has(source)) return matched;

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

