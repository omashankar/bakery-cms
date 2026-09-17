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

/**
 * A ROW OF ANY CATEGORY THE SHOP HAS — the open path beside the closed one.
 *
 * `HomepageProductSource` is six fixed values, and three of them are bakery
 * category slugs written as literals: photo-cakes, eggless, seasonal. A plant
 * shop was offered "Eggless Cakes" in Add Section and had no way to add
 * "Succulents" — the builder could arrange rows but not name one after a
 * category the shop invented.
 *
 * The union stays, because layouts already stored carry those values and a
 * shop that published an Eggless row keeps it. `eggless` and `seasonal` now
 * call THIS, so there is one implementation rather than two that can drift.
 *
 * Never padded. Every category rail is a row that says what its products
 * ARE — "Succulents" topped up with a cake is a false statement about the
 * row, the same reason the three named sources are exempt from the top-up
 * below.
 */
/**
 * WHAT THE CHEAPEST THING IN A CATEGORY COSTS — over all of it.
 *
 * Not `Math.min` over a RAIL. A rail is capped (ROW_CAP is 12) and ordered
 * by curation, so its cheapest member is the cheapest of the first twelve —
 * which is the true minimum today only because no category here has twelve
 * products yet. The day one does, a card reading "Starting from" would name
 * a price that is not the lowest on the page it links to, and nothing would
 * fail: the number would simply be wrong.
 *
 * Membership comes from `filterProductsByCategory`, the same function the
 * rails and the collection page use, because the promise a card makes is
 * about the page it links to and no other definition of the category.
 *
 * A category with nothing priced in it gets no entry at all, so the caller
 * renders no price rather than a zero.
 */
export function categoryStartingPrices(
  all: LandingProduct[],
  categories?: { name: string; slug: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};

  for (const category of categories ?? []) {
    const prices = filterProductsByCategory(all, category.slug, categories)
      .map((product) => product.price)
      .filter((price) => typeof price === "number" && Number.isFinite(price) && price > 0);

    if (prices.length) out[category.slug] = Math.min(...prices);
  }

  return out;
}

export function buildCategoryRail(
  slug: string,
  maxCount: number,
  adminMapped: LandingProduct[],
  all: LandingProduct[],
  categories?: { name: string; slug: string }[],
): LandingProduct[] {
  const admin = filterProductsByCategory(adminMapped, slug, categories);
  const merged = mergeWithCatalog(
    admin,
    filterProductsByCategory(all, slug, categories),
  );
  return merged.slice(0, maxCount);
}

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
  /**
   * Return the SELECTION, not a full grid.
   *
   * Private to `matchHomepageSource` below, which is the readable name for
   * it. The padding is a display decision about keeping a grid full, and a
   * caller that wants to ask "which products carry this flag" must not get
   * it — least of all by asking for a huge maxCount, which pads with the
   * entire shop.
   */
  unpadded = false,
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
    // Both go through `buildCategoryRail`, so the legacy rows and any row a
    // shop adds are one implementation. `maxCount` is applied again by the
    // caller below; passing it here changes nothing and keeps the helper
    // honest about its own contract.
    eggless: () => buildCategoryRail("eggless", maxCount, adminMapped, all, categories),
    seasonal: () => buildCategoryRail("seasonal", maxCount, adminMapped, all, categories),
  };

  const matched = sourceMatchers[source]();
  if (unpadded) return matched;
  return padRail(source, matched, all, maxCount);
}

/**
 * WHAT MATCHES A SOURCE, and nothing else.
 *
 * `buildHomepageProducts` pads its answer up to `maxCount` from the wider
 * catalogue, which is a display decision about keeping a grid full. Any
 * caller that wants the SELECTION rather than a full grid has to come here
 * instead — and asking for the selection by calling the padded one with a
 * huge maxCount does the opposite of what it looks like: it pads with the
 * entire shop. That is not hypothetical. It shipped for an hour, and the
 * Bestsellers row's Birthday tab listed eight products of which three were
 * not bestsellers at all.
 */
export function matchHomepageSource(
  source: HomepageProductSource,
  adminProducts: Product[],
  all: LandingProduct[],
  names?: TaxonomyNames,
  categories?: { name: string; slug: string }[],
): LandingProduct[] {
  return buildHomepageProducts(source, Number.POSITIVE_INFINITY, adminProducts, all, names, categories, true);
}

function padRail(
  source: HomepageProductSource,
  matched: LandingProduct[],
  all: LandingProduct[],
  maxCount: number,
): LandingProduct[] {
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

