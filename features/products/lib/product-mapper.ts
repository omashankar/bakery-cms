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
export type CategoryNames = ReadonlyMap<string, string>;

export function mapAdminProductToStorefront(
  cake: Product,
  categoryNames?: CategoryNames
): LandingProduct {
  const category =
    categoryNames?.get(cake.categoryId) ?? getCategoryById(cake.categoryId)?.name ?? "Cakes";

  return {
    id: cake.id,
    name: cake.name,
    slug: cake.slug,
    description: cake.description,
    price: cake.price,
    compareAtPrice: cake.compareAtPrice,
    image: cake.images[0] ?? "",
    category,
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
  };
}

export function getPublishedStorefrontProducts(
  cakes: Product[],
  categoryNames?: CategoryNames
): LandingProduct[] {
  return cakes
    .filter((cake) => cake.status === "published")
    // Not `.map(mapAdminProductToStorefront)`: map passes the INDEX as the
    // second argument, which would land in `categoryNames`.
    .map((cake) => mapAdminProductToStorefront(cake, categoryNames));
}
