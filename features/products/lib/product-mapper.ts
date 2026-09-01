import type { LandingProduct } from "@/constants/landing-data";
import { getCategoryById } from "@/features/catalog/lib/catalog-repository";
import type { Product } from "@/types/product";

export const DEFAULT_PRODUCT_SHAPES = ["Round", "Square", "Heart"] as const;

/**
 * Category names by id, for a caller that has the shop's real taxonomy.
 *
 * On the server `getCategoryById` reads a localStorage-backed store, which
 * answers with `defaultCatalogStore` — the DEMO taxonomy. So every
 * server-rendered product page resolved its category against the shipped list: a
 * shop that renamed a category still showed the shipped name, and a category the
 * shop had added resolved to nothing and rendered as the generic "Cakes".
 */
export interface TaxonomyNames {
  categories?: ReadonlyMap<string, string>;
  /** Occasion names by id — the storefront occasion filter had no data at all. */
  occasions?: ReadonlyMap<string, string>;
}

/** @deprecated kept so existing call sites read naturally. */
export type CategoryNames = TaxonomyNames;

export function mapAdminProductToStorefront(
  cake: Product,
  names?: TaxonomyNames
): LandingProduct {
  /**
   * The category's own name, or nothing — never the literal "Cakes".
   *
   * A product whose category id resolves to neither list was badged "Cakes" to
   * customers, so an orphaned phone charger advertised itself as a cake. The
   * Catalog screen's own delete warning promised this ("they will show them as
   * uncategorised"), and the code did the opposite.
   *
   * Empty rather than undefined, deliberately: `LandingProduct.category` is
   * typed `string` and the product page reads `.toLowerCase()` on it twice.
   * Making it optional would trade a wrong badge for the same TypeError class
   * `getProductVariantGroups` carried — so those two reads are guarded in the
   * same commit, and the badge simply does not render when there is no name.
   */
  const category =
    names?.categories?.get(cake.categoryId) ?? getCategoryById(cake.categoryId)?.name ?? "";

  // The occasions this cake is actually tagged with. The storefront filter used
  // to search the name, category and description for the word "Wedding" instead,
  // so a cake tagged Wedding was missed unless it happened to say so in prose,
  // and anything mentioning it in passing was included.
  const occasions = names?.occasions
    ? cake.occasionIds
        .map((id) => names.occasions?.get(id))
        .filter((name): name is string => Boolean(name))
    : undefined;

  return {
    id: cake.id,
    name: cake.name,
    slug: cake.slug,
    description: cake.description,
    price: cake.price,
    compareAtPrice: cake.compareAtPrice,
    image: cake.images[0] ?? "",
    category,
    occasions,
    badge: cake.isFeatured
      ? "Featured"
      : cake.isBestSeller
        ? "Bestseller"
        : cake.isTrending
          ? "Trending"
          : undefined,
    rating: cake.rating,
    reviewCount: cake.reviewCount,
    isEggless: cake.isEggless,
    flavours: cake.flavourOptions.length > 0 ? cake.flavourOptions : undefined,
    inStock: cake.stockStatus !== "out_of_stock",
    shapes: cake.shapes,
    allowsMessage: cake.allowsMessage,
    allowsPhotoUpload: cake.allowsPhotoUpload,
    ingredients: cake.ingredients,
    weights: cake.weights,
    barcode: cake.barcode,
    preparationTimeMinutes: cake.preparationTimeMinutes,
    shelfLifeDays: cake.shelfLifeDays,
    calories: cake.calories,
    allergens: cake.allergens,
    careInstructions: cake.careInstructions,
    variantGroups: cake.variantGroups,
    /**
     * This list is a WHITELIST, not a spread — a field missing from it persists
     * perfectly and is never seen by a customer, which is the second of the two
     * silent failures a new product field has to survive. The first is the
     * Mongoose path.
     */
    attributes: cake.attributes,
  };
}

export function getPublishedStorefrontProducts(
  cakes: Product[],
  names?: TaxonomyNames
): LandingProduct[] {
  return cakes
    .filter((cake) => cake.status === "published")
    // Not `.map(mapAdminProductToStorefront)`: map passes the INDEX as the
    // second argument, which would land in `categoryNames`.
    .map((cake) => mapAdminProductToStorefront(cake, names));
}
