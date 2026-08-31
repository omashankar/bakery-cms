import type { LandingProduct } from "@/constants/landing-data";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { earliestDeliveryDateString } from "@/features/orders/lib/delivery-date";
import {
  formatPreparationTime,
  formatShelfLife,
} from "@/features/products/lib/variant-utils";
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

/**
 * The shapes this product is offered in — empty when the merchant named none.
 *
 * The Round/Square/Heart fallback meant a customer buying a charger was shown a
 * shape picker, and `addToCart` stamped the chosen one onto the order line. The
 * same reasoning as `getProductFlavourOptions` above: a shipped list is not a
 * statement about this product.
 */
export function getProductShapeOptions(cake?: LandingProduct): string[] {
  return cake?.shapes ?? [];
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

/**
 * The earliest date the shop will bake for, as `YYYY-MM-DD`.
 *
 * This built a LOCAL instant and read it back in UTC — `date.setDate(...)` then
 * `toISOString()`. East of UTC those disagree: at 01:00 IST with a one-day lead
 * time, local tomorrow is still today in UTC, so the picker offered TODAY as
 * the earliest date and pre-selected it. West of UTC it errs the other way and
 * refuses a date the shop would have accepted.
 *
 * `delivery-date.ts` was written for precisely this and its header says so;
 * checkout already used `earliestDeliveryDateString` for the ZONE floor while
 * the shop-wide floor beside it still came from here. The product page had no
 * second opinion at all — it sets both the input's `min` and the delivery date
 * carried into the cart from this one value.
 */
export function getMinDeliveryDate(): string {
  const leadDays =
    typeof window !== "undefined"
      ? getCommerceSettings().deliveryLeadDays
      : defaultCommerceSettings.deliveryLeadDays;
  return earliestDeliveryDateString(leadDays);
}

/**
 * What the shop can actually promise, in the customer's words.
 *
 * The product page asserted "Same-day delivery" as static copy — twice, in the
 * feature list and again in the Delivery tab — while `deliveryLeadDays` on this
 * shop is 1, so the date picker directly beside it will not offer today. A
 * customer reading both saw the shop contradict itself, and the sentence that
 * loses is the one they had already decided to trust.
 */
export function getDeliveryPromise(): string {
  const leadDays =
    typeof window !== "undefined"
      ? getCommerceSettings().deliveryLeadDays
      : defaultCommerceSettings.deliveryLeadDays;

  return deliveryPromiseFor(leadDays);
}

/**
 * The same sentence, from a lead time the caller already has.
 *
 * Split out because `getDeliveryPromise` above reads the BROWSER's settings
 * cache and falls back to the shipped defaults on the server — so calling it
 * during a server render returns "Same-day delivery" for a next-day shop,
 * which is the exact claim this exists to stop. The homepage renders on the
 * server, so it passes the shop's real value in.
 *
 * Phrased as the earliest, never as a guarantee: a delivery zone can set its
 * own `minDeliveryDays` above the shop-wide figure.
 */
export function deliveryPromiseFor(leadDays: number): string {
  if (!Number.isFinite(leadDays) || leadDays <= 0) return "Same-day delivery";
  if (leadDays === 1) return "Next-day delivery";
  return `Delivery from ${leadDays} days ahead`;
}
