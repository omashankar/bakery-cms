import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import type { LandingOffer } from "@/constants/landing-data";
import { formatCurrency } from "@/utils/format";
import type { StoredCoupon } from "./coupons-repository";

/**
 * Turns the shop's real coupons into the offer cards the storefront advertises.
 *
 * The homepage's "Special Offers" row used to map `specialOffers` — a hardcoded
 * array in constants/landing-data.ts — and had no path to the coupon store at
 * all. So the row advertised "Birthday Special · 20% OFF · code BDAY20" whether
 * or not BDAY20 existed, was active, or still carried that discount: deactivate
 * it in Coupons and the homepage kept offering it to every visitor, with a code
 * checkout then refused. One of the three cards ("Weekend Delight — buy 2
 * pastries get 1 free") had no code at all and nothing in the system honoured
 * it.
 *
 * The wedding page read real coupons but topped the row up from the same
 * hardcoded array whenever there were too few, so it advertised invented codes
 * for exactly the same reason, just fewer of them.
 *
 * A discount row is a promise. Every card here comes from a coupon a customer
 * can actually redeem, and a shop with two live coupons shows two cards.
 */

/** Decoration only — a coupon carries no image, so cards rotate through these. */
const OFFER_PHOTOS = [
  demoPhotoIds.chocolateCake,
  demoPhotoIds.pastries,
  demoPhotoIds.berryCake,
  demoPhotoIds.cupcakes,
  demoPhotoIds.stackCake,
  demoPhotoIds.redVelvet,
] as const;

/**
 * The discount as a customer reads it on the badge.
 *
 * `currency` is threaded rather than assumed: hardcoding the rupee here would
 * put a "₹500 OFF" badge on the same page as "$500.00" product cards for a shop
 * that picked USD, and `utils/format.ts` carries a comment about that exact
 * regression ("used to be hard-coded to INR here, which made the admin's
 * currency picker decorative"). On the server there is no `<html>` to read the
 * locale from, so the caller passes it.
 */
export function couponDiscountLabel(coupon: StoredCoupon, currency?: string): string {
  if (coupon.percentOff) return `${coupon.percentOff}% OFF`;
  if (coupon.flatOff) return `${money(coupon.flatOff, currency)} OFF`;
  return "Special Offer";
}

/**
 * A currency code Intl will accept, or nothing.
 *
 * `formatCurrency` resolves its argument with `??`, so an empty string or a
 * legacy non-ISO value read straight out of Settings is NOT replaced by the shop
 * default — it reaches `new Intl.NumberFormat(...)`, which throws `RangeError:
 * Invalid currency code`. The storefront calls this from an async server
 * component, so one bad settings value would take down the whole homepage and
 * the wedding page for every visitor.
 */
function usableCurrency(currency?: string): string | undefined {
  const code = currency?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : undefined;
}

/** Formatting must never be the reason a page fails to render. */
function money(amount: number, currency?: string): string {
  try {
    return formatCurrency(amount, usableCurrency(currency));
  } catch {
    return String(amount);
  }
}

/**
 * Whether a coupon is live — the same two conditions `evaluateCoupon` applies
 * before checkout will accept the code.
 *
 * `minSubtotal` is not one of them, because it is a property of the cart rather
 * than of the coupon: an offer with a minimum is still a real offer, and the
 * customer can qualify by adding to their basket. But it must be SHOWN, which is
 * what `minSubtotal` on the card is for — otherwise a "₹500 OFF · SAVE500" card
 * sends someone with a ₹1,200 basket to a checkout that refuses the code, which
 * is the very failure this module exists to end.
 */
export function isLiveCoupon(coupon: StoredCoupon, now = Date.now()): boolean {
  if (!coupon.isActive) return false;
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return false;
  return true;
}

/**
 * Two pieces of copy that say the same thing, allowing for formatting.
 *
 * A coupon's label is usually the discount itself, which the card's badge
 * already shows — so the title is dropped when it repeats it. Comparing the
 * strings directly was not enough: the badge is built with `formatCurrency`, so
 * a coupon labelled "₹2000 OFF" sat under a badge reading "₹2,000 OFF" and both
 * rendered, one comma apart. Seen on the live homepage before this.
 */
function sameCopy(a: string, b: string): boolean {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalise(a) === normalise(b);
}

export function couponToOffer(
  coupon: StoredCoupon,
  index = 0,
  currency?: string
): LandingOffer {
  const discount = couponDiscountLabel(coupon, currency);
  return {
    id: coupon.id,
    title: sameCopy(coupon.label, discount) ? "" : coupon.label,
    description: coupon.description,
    discount,
    code: coupon.code,
    // The condition checkout will hold them to, in the words the card shows.
    minSpend: coupon.minSubtotal
      ? `On orders over ${money(coupon.minSubtotal, currency)}`
      : undefined,
    image: unsplash(OFFER_PHOTOS[index % OFFER_PHOTOS.length], 600, 400),
    // Only a real end date. The previous mapper substituted "2026-12-31" for a
    // coupon with no expiry, putting an invented deadline on an open offer.
    expiresAt: coupon.expiresAt ?? "",
  };
}

/**
 * Live coupons as offer cards. Fewer live coupons means fewer cards — the row
 * is never padded, because there is nothing truthful to pad it with.
 */
export function selectStorefrontOffers(
  coupons: StoredCoupon[],
  maxCount = 3,
  options?: { currency?: string; now?: number },
): LandingOffer[] {
  const now = options?.now ?? Date.now();
  return coupons
    .filter((coupon) => isLiveCoupon(coupon, now))
    .slice(0, Math.max(0, maxCount))
    .map((coupon, index) => couponToOffer(coupon, index, options?.currency));
}

/**
 * Does this coupon read as a wedding offer?
 *
 * Matches "wedding" only. A bare "wed" test is a strict superset of it, so a
 * shop's "Wednesday Wonders" promo was classified as a wedding offer and pushed
 * ahead of the real wedding coupon in the wedding page's three-card row — where
 * the wedding coupon is the one the customer came for.
 */
export function isWeddingCoupon(coupon: StoredCoupon): boolean {
  return `${coupon.code} ${coupon.label} ${coupon.description}`
    .toLowerCase()
    .includes("wedding");
}

/**
 * Wedding offers first, then the shop's other live coupons to fill the row.
 *
 * The top-up is kept — a single lonely card in a three-column grid looks broken
 * — but it now draws on real coupons, so a customer who reads a card and types
 * the code gets the discount it advertised.
 */
export function selectWeddingCouponOffers(
  coupons: StoredCoupon[],
  maxCount = 3,
  options?: { currency?: string; now?: number },
): LandingOffer[] {
  const now = options?.now ?? Date.now();
  const live = coupons.filter((coupon) => isLiveCoupon(coupon, now));
  const wedding = live.filter(isWeddingCoupon);
  const weddingIds = new Set(wedding.map((coupon) => coupon.id));
  const rest = live.filter((coupon) => !weddingIds.has(coupon.id));
  return [...wedding, ...rest]
    .slice(0, Math.max(0, maxCount))
    .map((coupon, index) => couponToOffer(coupon, index, options?.currency));
}
