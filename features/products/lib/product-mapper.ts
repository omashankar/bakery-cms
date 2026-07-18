import type { LandingProduct } from "@/constants/landing-data";
import { getCategoryById } from "@/features/catalog/lib/catalog-repository";
import type { Product } from "@/types/product";

export const DEFAULT_PRODUCT_SHAPES = ["Round", "Square", "Heart"] as const;

export function mapAdminProductToStorefront(cake: Product): LandingProduct {
  const category = getCategoryById(cake.categoryId)?.name ?? "Cakes";

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

export function getPublishedStorefrontProducts(cakes: Product[]): LandingProduct[] {
  return cakes
    .filter((cake) => cake.status === "published")
    .map(mapAdminProductToStorefront);
}
