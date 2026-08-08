import type { LandingProduct, LandingOffer } from "@/constants/landing-data";
import { galleryImages } from "@/constants/landing-data";
import { selectWeddingCouponOffers } from "@/features/commerce/lib/coupon-offers";
import { getActiveCoupons, type StoredCoupon } from "@/features/commerce/lib/coupons-repository";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";

/**
 * Pure selector — shared by the client store AND the server render, so both
 * passes agree. The server computes this from MongoDB products and passes the
 * snapshot down as a prop; the client renders the prop rather than re-reading its
 * local store, which is what keeps the wedding page hydration-safe.
 *
 * The grid used to be topped up from `weddingCakes`, the hardcoded demo array,
 * whenever the shop had fewer wedding cakes than the section asked for. Those
 * cards are not decoration: each is a full link wrapping a photo, a name and a
 * "Starting from ₹15,999" line, pointing at /store/cakes/<slug>. They only
 * resolve because the same demo cakes happen to have been seeded into the
 * catalogue — delete them from Products, which an admin setting up their own
 * shop would, and the wedding page goes on advertising them straight to a 404.
 *
 * A collection shows what the shop sells.
 */
export function selectWeddingCollectionProducts(
  products: LandingProduct[],
  maxCount = 6
): LandingProduct[] {
  return products
    .filter(
      (cake) =>
        cake.category.toLowerCase().includes("wedding") || cake.slug.includes("wedding")
    )
    .slice(0, maxCount);
}

export function getWeddingCollectionProducts(maxCount = 6): LandingProduct[] {
  return selectWeddingCollectionProducts(
    getPublishedStorefrontProducts(loadProducts()),
    maxCount
  );
}

/**
 * Pure selector — same story as selectWeddingCollectionProducts, for offers.
 *
 * This used to top the row up from `specialOffers`, the hardcoded demo array, so
 * a shop with one wedding coupon still advertised BDAY20 and a codeless "buy 2
 * pastries get 1 free" that nothing in the system honoured. It draws on the
 * shop's real coupons now — see features/commerce/lib/coupon-offers.ts.
 */
export function selectWeddingOffers(
  coupons: StoredCoupon[],
  maxCount = 3,
  options?: { currency?: string }
): LandingOffer[] {
  return selectWeddingCouponOffers(coupons, maxCount, options);
}

export function getWeddingOffers(maxCount = 3): LandingOffer[] {
  return selectWeddingOffers(getActiveCoupons(), maxCount);
}

export function getWeddingGalleryImages(maxCount = 8): string[] {
  return galleryImages.slice(0, maxCount);
}
