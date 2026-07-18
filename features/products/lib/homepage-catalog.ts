import type { LandingProduct, LandingCategory } from "@/constants/landing-data";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getCategories } from "@/features/catalog/lib/catalog-repository";
import { getAllProducts } from "@/features/products/lib/product-catalog";
import {
  buildHomepageProducts,
  type HomepageProductSource,
} from "@/features/products/lib/homepage-rails";

export type { HomepageProductSource };

/**
 * Browser-side wrappers.
 *
 * The selection logic itself lives in the products domain so the server can run
 * it too; these just supply the client catalogue.
 */
export function getHomepageProducts(
  source: HomepageProductSource,
  maxCount = 8
): LandingProduct[] {
  return buildHomepageProducts(source, maxCount, loadProducts(), getAllProducts());
}

export function getHomepageCategories(maxCount = 6): LandingCategory[] {
  const publishedProducts = loadProducts().filter((cake) => cake.status === "published");

  const mapped = getCategories().map((category) => {
    const count =
      category.cakeCount ??
      publishedProducts.filter((cake) => cake.categoryId === category.id).length;

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image ?? "",
      count,
    } satisfies LandingCategory;
  });

  return mapped.filter((category) => category.image).slice(0, maxCount);
}
