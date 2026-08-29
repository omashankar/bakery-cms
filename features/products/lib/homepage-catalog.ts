import type { LandingProduct, LandingCategory, LandingOffer } from "@/constants/landing-data";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getCategories } from "@/features/catalog/lib/catalog-repository";
import { selectStorefrontOffers } from "@/features/commerce/lib/coupon-offers";
import { getActiveCoupons } from "@/features/commerce/lib/coupons-repository";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
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
/**
 * The shop's OWN cakes, never the shipped demo ones.
 *
 * The pool used to be `getAllProducts()`, which is
 * `mergeStorefrontProducts()`: it starts from the 37 hardcoded cakes in
 * constants/landing-data.ts and only overwrites the entries whose slug a real
 * product happens to share, leaving the rest in place AHEAD of the shop's own.
 * That was fine for the demo site and wrong everywhere else — the admin's
 * builder preview drew its six product grids from it, so a shop with four cakes
 * previewed four grids containing none of them, and published a homepage it had
 * never seen.
 *
 * The storefront builds the same rails from published products alone
 * (products-service.getHomepageRails), so this now uses the same pool. It is
 * only a stand-in: the builder fetches the server's rails from
 * /api/builders/homepage/preview-data, and this runs for the moment before that
 * lands, or if it fails.
 */
export function getHomepageProducts(
  source: HomepageProductSource,
  maxCount = 8
): LandingProduct[] {
  const cached = loadProducts();
  return buildHomepageProducts(source, maxCount, cached, getPublishedStorefrontProducts(cached));
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
          // Counted, never declared.
          //
          // This was `category.cakeCount ?? <the real count>`, so a number typed
          // into the category form OVERRODE the shop's actual catalogue — and
          // the seed had typed one for nine of them. Measured on a real shop:
          // the homepage advertised "48 cakes" under Birthday and 271 across all
          // categories, while the whole shop held 25 products.
          count: published.filter((cake) => cake.categoryId === category.id).length,
        }) satisfies LandingCategory
    )
    .filter((category) => category.image)
    .slice(0, maxCount);
}

export function getHomepageCategories(maxCount = 6): LandingCategory[] {
  return selectHomepageCategories(loadProducts(), getCategories(), maxCount);
}

/**
 * Browser-side offers, for the builder preview only.
 *
 * The storefront reads coupons on the server and passes the cards down; this is
 * the fallback the admin's preview panel uses, exactly as `getHomepageProducts`
 * and `getHomepageCategories` above are.
 */
export function getHomepageOffers(maxCount = 3): LandingOffer[] {
  return selectStorefrontOffers(getActiveCoupons(), maxCount);
}
