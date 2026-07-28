import type { LandingProduct, LandingOffer } from "@/constants/landing-data";
import { galleryImages, specialOffers, weddingCakes } from "@/constants/landing-data";
import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import { getActiveCoupons, type StoredCoupon } from "@/features/commerce/lib/coupons-repository";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";

function couponToOffer(coupon: ReturnType<typeof getActiveCoupons>[number]): LandingOffer {
  const discount = coupon.percentOff
    ? `${coupon.percentOff}% OFF`
    : coupon.flatOff
      ? `₹${coupon.flatOff.toLocaleString("en-IN")} OFF`
      : "Special Offer";

  return {
    id: coupon.id,
    title: coupon.label,
    description: coupon.description,
    discount,
    code: coupon.code,
    image: unsplash(demoPhotoIds.weddingCake, 600, 400),
    expiresAt: coupon.expiresAt ?? "2026-12-31",
  };
}

function isWeddingOffer(offer: LandingOffer): boolean {
  const haystack = `${offer.title} ${offer.description} ${offer.code ?? ""}`.toLowerCase();
  return haystack.includes("wedding") || haystack.includes("wed");
}

/**
 * Pure selector — shared by the client store AND the server render, so both
 * passes agree. The server computes this from MongoDB products and passes the
 * snapshot down as a prop; the client renders the prop rather than re-reading its
 * local store, which is what keeps the wedding page hydration-safe.
 */
export function selectWeddingCollectionProducts(
  products: LandingProduct[],
  maxCount = 6
): LandingProduct[] {
  const weddingFromAdmin = products.filter(
    (cake) =>
      cake.category.toLowerCase().includes("wedding") || cake.slug.includes("wedding")
  );
  const slugs = new Set(weddingFromAdmin.map((cake) => cake.slug));
  const extras = weddingCakes.filter((cake) => !slugs.has(cake.slug));
  return [...weddingFromAdmin, ...extras].slice(0, maxCount);
}

export function getWeddingCollectionProducts(maxCount = 6): LandingProduct[] {
  return selectWeddingCollectionProducts(
    getPublishedStorefrontProducts(loadProducts()),
    maxCount
  );
}

/** Pure selector — same story as selectWeddingCollectionProducts, for offers. */
export function selectWeddingOffers(coupons: StoredCoupon[], maxCount = 3): LandingOffer[] {
  const couponOffers = coupons
    .filter(
      (coupon) =>
        coupon.isActive &&
        (coupon.code.includes("WED") ||
          coupon.label.toLowerCase().includes("wedding") ||
          coupon.description.toLowerCase().includes("wedding"))
    )
    .map(couponToOffer);

  const landingOffers = specialOffers.filter(isWeddingOffer);
  const relevant = [...couponOffers, ...landingOffers];

  // De-dupe and keep the grid full — top up with general offers so the row never
  // shows a single lonely card in an otherwise empty three-column grid.
  const seen = new Set(relevant.map((offer) => offer.id));
  const extras = specialOffers.filter((offer) => !seen.has(offer.id));
  return [...relevant, ...extras].slice(0, maxCount);
}

export function getWeddingOffers(maxCount = 3): LandingOffer[] {
  return selectWeddingOffers(getActiveCoupons(), maxCount);
}

export function getWeddingGalleryImages(maxCount = 8): string[] {
  return galleryImages.slice(0, maxCount);
}
