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

/**
 * Pure selector — shared by the client store AND the server render, so both
 * passes agree. The server computes this from MongoDB products + catalog and
 * passes the snapshot down as a prop; the client renders the prop rather than
 * re-reading its local stores, which keeps the homepage hydration-safe.
 */
export function selectHomepageCategories(
  products: readonly { status: string; categoryId: string }[],
  categories: readonly {
    id: string;
    name: string;
    slug: string;
    image?: string;
    cakeCount?: number;
  }[],
  maxCount = 6
): LandingCategory[] {
  const published = products.filter((cake) => cake.status === "published");
  return categories
    .map(
      (category) =>
        ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          image: category.image ?? "",
          count:
            category.cakeCount ??
            published.filter((cake) => cake.categoryId === category.id).length,
        }) satisfies LandingCategory
    )
    .filter((category) => category.image)
    .slice(0, maxCount);
}

export function getHomepageCategories(maxCount = 6): LandingCategory[] {
  return selectHomepageCategories(loadProducts(), getCategories(), maxCount);
}
