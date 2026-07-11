import type { LandingCake, LandingOffer } from "@/constants/landing-data";
import { galleryImages, specialOffers, weddingCakes } from "@/constants/landing-data";
import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import { getActiveCoupons } from "@/features/admin/commerce/lib/coupons-repository";
import { loadCakes } from "@/features/admin/cakes/lib/cakes-repository";
import { getPublishedStorefrontCakes } from "@/features/admin/cakes/lib/cake-mapper";
import { filterCakesByCategory, getAllCakes } from "./catalog";

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

export function getWeddingCollectionCakes(maxCount = 6): LandingCake[] {
  const published = getPublishedStorefrontCakes(loadCakes());
  const weddingFromAdmin = published.filter(
    (cake) =>
      cake.category.toLowerCase().includes("wedding") ||
      cake.slug.includes("wedding")
  );

  const merged =
    weddingFromAdmin.length > 0
      ? weddingFromAdmin
      : filterCakesByCategory(getAllCakes(), "wedding");

  const fallback = weddingCakes;
  const slugs = new Set(merged.map((cake) => cake.slug));
  const extras = fallback.filter((cake) => !slugs.has(cake.slug));

  return [...merged, ...extras].slice(0, maxCount);
}

export function getWeddingOffers(maxCount = 3): LandingOffer[] {
  const couponOffers = getActiveCoupons()
    .filter(
      (coupon) =>
        coupon.code.includes("WED") ||
        coupon.label.toLowerCase().includes("wedding") ||
        coupon.description.toLowerCase().includes("wedding")
    )
    .map(couponToOffer);

  const landingOffers = specialOffers.filter(isWeddingOffer);
  const merged = couponOffers.length > 0 ? couponOffers : landingOffers;

  if (merged.length > 0) return merged.slice(0, maxCount);
  return specialOffers.slice(0, maxCount);
}

export function getWeddingGalleryImages(maxCount = 8): string[] {
  return galleryImages.slice(0, maxCount);
}
