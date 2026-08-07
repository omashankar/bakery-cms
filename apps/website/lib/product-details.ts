import type { LandingProduct } from "@/constants/landing-data";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  createDefaultVariantGroups,
  formatPreparationTime,
  formatShelfLife,
} from "@/features/products/lib/variant-utils";
import type { ProductVariantGroup } from "@/types/product";
import { fetchApprovedReviews } from "@/features/reviews/lib/reviews-api";

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  title?: string;
  date: string;
  adminReply?: string;
  repliedAt?: string;
  isFeatured?: boolean;
}

export function getProductGalleryImages(cake: LandingProduct): string[] {
  // Products carry a single real image; show only that — never pad the gallery
  // with unrelated stock photos that don't depict the actual cake.
  return [cake.image];
}

/**
 * Flavours this product is actually offered in — empty when the merchant has
 * not configured any.
 *
 * This used to fall back to the first four catalogue flavours, which produced
 * nonsense: a "Red Velvet Classic" was offered in Chocolate/Vanilla/Fruit/
 * Butterscotch (Red Velvet itself was cut off by the slice), and Chocolate was
 * preselected — so the order recorded a flavour that contradicted the cake and
 * that the customer never chose. A global flavour list is a catalogue taxonomy,
 * not a per-product option set.
 */
export function getProductFlavourOptions(cake: LandingProduct): string[] {
  return cake.flavours ?? [];
}

export function getProductShapeOptions(cake?: LandingProduct): string[] {
  if (cake?.shapes?.length) return cake.shapes;
  return ["Round", "Square", "Heart"];
}

export function getProductVariantGroups(cake: LandingProduct): ProductVariantGroup[] {
  if (cake.variantGroups?.length) return cake.variantGroups;

  return createDefaultVariantGroups({
    isEggless: cake.isEggless,
    isPhotoCake:
      cake.allowsPhotoUpload === true || cake.category.toLowerCase().includes("photo"),
  });
}

export function getProductDetailBadges(cake: LandingProduct): string[] {
  const badges: string[] = [];
  const prep = formatPreparationTime(cake.preparationTimeMinutes);
  const shelf = formatShelfLife(cake.shelfLifeDays);
  if (prep) badges.push(prep);
  if (shelf) badges.push(shelf);
  if (cake.calories) badges.push(`${cake.calories} kcal / serving`);
  if (cake.barcode) badges.push(`SKU ${cake.barcode}`);
  return badges;
}

export function getDeliveryTimeSlots(): string[] {
  const slots =
    typeof window !== "undefined"
      ? getCommerceSettings().deliveryTimeSlots
      : defaultCommerceSettings.deliveryTimeSlots;
  return slots.filter((slot) => slot.trim().length > 0);
}

/**
 * The reviews a customer sees, from the server.
 *
 * This read `getStorefrontReviewsForProduct` — the visitor's own localStorage —
 * so no moderation decision ever reached a customer, and a first-time visitor
 * with empty storage was shown a machine-generated set attributed to invented
 * people. Nothing on the storefront called the public reviews endpoint at all.
 *
 * Null means the read failed; the caller keeps whatever it was showing rather
 * than replacing a real list with an empty one.
 */
export async function getProductReviews(
  cake: LandingProduct
): Promise<ProductReview[] | null> {
  if (typeof window === "undefined") return [];

  const stored = await fetchApprovedReviews(cake.slug);
  if (!stored) return null;

  // The endpoint already sorts featured-first, then newest.
  return stored.map((review) => ({
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    text: review.body,
    title: review.title,
    date: review.createdAt,
    adminReply: review.adminReply,
    repliedAt: review.repliedAt,
    isFeatured: review.isFeatured,
  }));
}

export function getMinDeliveryDate(): string {
  const leadDays =
    typeof window !== "undefined"
      ? getCommerceSettings().deliveryLeadDays
      : defaultCommerceSettings.deliveryLeadDays;
  const date = new Date();
  date.setDate(date.getDate() + Math.max(leadDays, 0));
  return date.toISOString().split("T")[0] ?? "";
}
