import {
  filterProductsByCategory,
  productsInCollection,
  productsInDepartment,
  productsTaggedForOccasion,
} from "@/features/products/lib/product-catalog";
import { categories as demoCategories, type LandingProduct } from "@/constants/landing-data";
import {
  applyCollectionFilters,
  collectionPriceCeiling,
  defaultCollectionFilters,
  getFilterFlavourOptions,
  getFilterOccasionOptions,
  getFilterOptionFacets,
  getFilterWeightOptions,
  pruneOptionSelections,
} from "@/apps/website/lib/collection-filters";

/**
 * WHICH PRODUCTS A LISTING PAGE IS ABOUT, and the first page of them.
 *
 * Plain functions, shared by the listing's server wrapper and its client
 * component. The server draws every card a listing can show (so the cards are
 * markup, not client code) and has to know which four open the page to load
 * their photos first; the client filters and sorts what the server drew. Both
 * answer from here, so they cannot disagree about either.
 */

export const LISTING_PAGE_SIZE = 24;

export interface ListingSource {
  catalog: LandingProduct[];
  categorySlug?: string;
  categories?: { id: string; name: string; slug: string; headline?: string }[];
  collection?: { productIds: string[] };
  occasion?: { slug: string };
  department?: { categoryIds: string[] };
}

/** The shop's categories, one per slug — the demo list only when it has none. */
export function categoryPillsFor(categoriesFromShop: ListingSource["categories"]) {
  const source = categoriesFromShop?.length ? categoriesFromShop : demoCategories;
  /*
    `headline` rides along, optional, because the demo fallback has none —
    the Map's type is what decides whether the shop's own phrase survives
    the dedup, and a narrower one silently drops it.
  */
  const bySlug = new Map<
    string,
    { id: string; name: string; slug: string; headline?: string }
  >();
  for (const category of source) {
    if (category.slug && !bySlug.has(category.slug)) bySlug.set(category.slug, category);
  }
  return [...bySlug.values()];
}

/** Every product the page is about, before any filter the customer sets. */
export function productsForListing(
  source: ListingSource,
  categoryPills = categoryPillsFor(source.categories),
): LandingProduct[] {
  const { catalog, collection, occasion, department } = source;
  if (collection) return productsInCollection(catalog, collection.productIds);
  /*
    An occasion matches the product's own tags, and ONLY those — not the
    category that happens to share its slug. `filterProductsByCategory` ORs
    the two, which is right at the old address and wrong here: the point of
    this page is to show what the shop tagged for this occasion.
  */
  if (occasion) return productsTaggedForOccasion(catalog, occasion.slug);
  /*
    A DEPARTMENT IS TWO STEPS from a product: it holds categories and they
    hold products. So this is the one source that cannot be a name match or
    an id list of products — it is every product in any of its categories,
    matched by category id, which both the stored row and the card carry.
  */
  if (department) return productsInDepartment(catalog, department.categoryIds);
  return filterProductsByCategory(catalog, source.categorySlug || undefined, categoryPills);
}

/** What the page shows before the customer touches anything. */
export function firstListingPage(
  source: ListingSource & { initialSearch?: string },
): LandingProduct[] {
  const inCategory = productsForListing(source);
  const filters = {
    ...defaultCollectionFilters(collectionPriceCeiling(source.catalog)),
    search: source.initialSearch ?? "",
  };
  const shown = pruneOptionSelections(filters, getFilterOptionFacets(inCategory), {
    weights: getFilterWeightOptions(inCategory),
    flavours: getFilterFlavourOptions(inCategory),
    occasions: getFilterOccasionOptions(inCategory),
  });
  return applyCollectionFilters(inCategory, shown).slice(0, LISTING_PAGE_SIZE);
}
