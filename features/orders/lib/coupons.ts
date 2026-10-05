import { hasExpired } from "@/lib/expiry-date";
import { formatCurrency } from "@/utils/format";
import {
  getActiveCoupons,
  getCouponByCode,
} from "@/features/commerce/lib/coupons-repository";
import type { CartTotals } from "./cart-totals";

export interface CouponDefinition {
  code: string;
  label: string;
  description: string;
  minSubtotal?: number;
  percentOff?: number;
  flatOff?: number;
}

export interface AppliedCoupon {
  code: string;
  label: string;
  discountAmount: number;
  /**
   * The money the discount was taken from.
   *
   * The same as the cart subtotal for an unscoped coupon, and less for a
   * scoped one. Carried so the draft and the order can say what the number
   * was a percentage OF — otherwise a 20%-of-plants discount on a mixed
   * basket reads, on the invoice, like arithmetic nobody can reproduce.
   */
  eligibleSubtotal?: number;
}

export function getAvailableCouponCodes(): string[] {
  return getActiveCoupons().map((coupon) => coupon.code);
}

/** The shape both sides need from a stored coupon, so this stays pure. */
export interface CouponRule {
  code: string;
  label: string;
  isActive?: boolean;
  expiresAt?: string;
  minSubtotal?: number;
  percentOff?: number;
  flatOff?: number;
  /**
   * The categories this code applies to. EMPTY OR ABSENT MEANS THE WHOLE SHOP.
   *
   * Both readings have to behave identically and not just nearly: `.lean()`
   * gives every coupon written before this existed `undefined`, while anything
   * saved since gets `[]` from the schema default. A check that treated one as
   * "unscoped" and the other as "scoped to nothing" would turn every coupon in
   * the shop today into a code that discounts nothing — silently, because
   * `discountAmount <= 0` refuses with a message about the order.
   */
  categoryIds?: string[];
}

/**
 * One line of a cart, as much of it as a coupon needs to see.
 *
 * `categoryIds` is EVERY category the product is filed under — `categoriesOf`,
 * not `categoryId` — because a cake also filed under Plants must be discounted
 * by a plants coupon. That is the whole point of the box that filed it there.
 */
export interface CouponCartLine {
  productSlug: string;
  categoryIds: string[];
  price: number;
  quantity: number;
}

/**
 * What a coupon is measured against: the lines, or just a number.
 *
 * The number is kept because plenty of callers have no cart — a wedding
 * enquiry, an offer card asking "how much more to qualify". A SCOPED coupon
 * cannot be judged from a number, and `evaluateCoupon` refuses rather than
 * guessing; see the note there.
 */
export type CouponCart = number | readonly CouponCartLine[];

/**
 * The money a scoped coupon is allowed to touch.
 *
 * "20% off plants" on a basket holding ₹1,000 of plants and ₹2,000 of cake
 * discounts ₹200, not ₹600. The shop offered plants; the cake beside them is
 * charged in full. This is also what the MINIMUM is measured against — "over
 * ₹2,000" on a plants coupon means ₹2,000 of plants, because that is what the
 * offer says.
 *
 * Unscoped, it is the whole cart, so every coupon that exists today behaves
 * exactly as it did.
 */
export function couponEligibleSubtotal(
  rule: Pick<CouponRule, "categoryIds">,
  lines: readonly CouponCartLine[],
): number {
  const scope = new Set(rule.categoryIds ?? []);
  const counts = scope.size
    ? (line: CouponCartLine) => line.categoryIds.some((id) => scope.has(id))
    : () => true;

  return lines.reduce((sum, line) => (counts(line) ? sum + line.price * line.quantity : sum), 0);
}

/**
 * The one place a discount is decided, given a list of coupons and a subtotal.
 *
 * Pure and list-driven so the SERVER can run it against the coupons in Mongo.
 * Until now this logic only existed against `localStorage`, which meant a coupon
 * was valid because the customer's browser said so — and the order carried a
 * `coupon` object the caller could invent outright, discount included.
 */
/** Rounds to the currency's minor unit — whole rupees, cents elsewhere. */
function roundToCurrency(value: number, currency = "INR"): number {
  const digits = ["INR", "JPY", "KRW", "VND"].includes(currency.toUpperCase()) ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function evaluateCoupon(
  coupons: CouponRule[],
  code: string,
  cart: CouponCart,
  now = Date.now(),
  /** Defaults to rupees, so every existing caller's arithmetic is unchanged. */
  currency?: string,
): { ok: true; coupon: AppliedCoupon } | { ok: false; message: string } {
  /**
   * Both branches derived from `cart` directly, not from each other.
   *
   * `lines ? … : cart` reads fine and does not narrow: TypeScript cannot see
   * that `lines` being null implies `cart` is a number, so `cartSubtotal` came
   * out as the union and every arithmetic use of it below failed.
   */
  const lines = typeof cart === "number" ? null : cart;
  const cartSubtotal =
    typeof cart === "number"
      ? cart
      : cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, message: "Enter a coupon code" };
  }

  const definition = coupons.find((item) => item.code.trim().toUpperCase() === normalized);
  if (!definition || definition.isActive === false) {
    return { ok: false, message: "Invalid coupon code" };
  }

  // Fails closed on an unparseable value: `NaN < now` is false, so a coupon
  // with expiresAt "31/12/2026" used to be permanently live.
  if (hasExpired(definition.expiresAt, now)) {
    return { ok: false, message: "This coupon has expired" };
  }

  /**
   * A SCOPED coupon judged from a bare number FAILS, rather than guessing.
   *
   * Some callers have no cart to hand — a wedding enquiry, an offer card
   * working out how much more you would need to spend. Given only a total,
   * there is no way to know how much of it is plants. Treating the total as
   * eligible would discount the cake as well; treating it as zero would refuse
   * a code that should have worked, with a message about the order rather than
   * about the caller.
   *
   * So it refuses in a way the customer can act on, and — because this is the
   * same function the server runs — a browser that took the other branch could
   * never talk the server into agreeing with it.
   */
  if (definition.categoryIds?.length && !lines) {
    return { ok: false, message: "This code applies to selected items only" };
  }

  /**
   * Everything below measures the ELIGIBLE money, not the cart's.
   *
   * Unscoped, `couponEligibleSubtotal` returns the whole cart, so every coupon
   * in the shop today computes exactly the number it computed before.
   */
  const base = lines ? couponEligibleSubtotal(definition, lines) : cartSubtotal;

  if (definition.minSubtotal && base < definition.minSubtotal) {
    /**
     * In the shop’s own money, not India’s.
     *
     * This read `toLocaleString("en-IN")` — Indian digit grouping and no
     * currency symbol at all — three lines below a `currency` argument this
     * function already takes and was using correctly for the discount itself.
     * So a shop priced in dollars refused a coupon with “Minimum order 1,500
     * required”, and the customer had to guess which 1,500.
     */
    return {
      ok: false,
      message: `Minimum order ${formatCurrency(definition.minSubtotal, currency)} required`,
    };
  }

  let discountAmount = 0;
  if (definition.percentOff) {
    // Rounded to the CURRENCY's minor unit, like every other money figure in
    // the pipeline. A bare `Math.round` is whole units, so a USD shop's 10%
    // coupon on $12.50 gave $1.00 — an 8% discount, quietly — and every
    // fractional-cent shop rounded a customer's saving away.
    discountAmount = roundToCurrency(base * (definition.percentOff / 100), currency);
  } else if (definition.flatOff) {
    discountAmount = definition.flatOff;
  }

  /**
   * Capped by the ELIGIBLE money, so a flat coupon cannot spill.
   *
   * "₹500 off plants" on ₹200 of plants beside ₹3,000 of cake takes ₹200, not
   * ₹500 — capping against the cart total instead would quietly let a plants
   * coupon pay for the cake.
   */
  discountAmount = Math.min(discountAmount, base);
  if (discountAmount <= 0) {
    /**
     * Also how "there are no plants in this basket" comes out.
     *
     * A scoped coupon over a basket holding none of its categories has an
     * eligible subtotal of 0, so every branch above yields 0 and this refuses.
     * The message is the general one on purpose: the customer's problem is the
     * same either way, and naming the category here would need the taxonomy,
     * which this file is pure of.
     */
    return { ok: false, message: "Coupon cannot be applied to this order" };
  }

  return {
    ok: true,
    coupon: {
      code: definition.code,
      label: definition.label,
      discountAmount,
      // What it was taken FROM, so the order and the draft can record why the
      // number is what it is rather than leaving it to be re-derived.
      eligibleSubtotal: base,
    },
  };
}

/** Server convenience: the applied coupon, or null when it does not hold. */
export function resolveCouponDiscount(
  coupons: CouponRule[],
  code: string,
  cart: CouponCart,
): AppliedCoupon | null {
  const result = evaluateCoupon(coupons, code, cart);
  return result.ok ? result.coupon : null;
}

/** The browser's entry point — same rules, against the local coupon cache. */
export function applyCouponCode(
  code: string,
  cart: CouponCart
): { ok: true; coupon: AppliedCoupon } | { ok: false; message: string } {
  const normalized = code.trim().toUpperCase();
  const definition = getCouponByCode(normalized);
  return evaluateCoupon(definition ? [definition as CouponRule] : [], normalized, cart);
}

// `recordCouponUsage` lived here and is gone.
//
// It called the browser's `incrementCouponUsage`, which read the local coupon
// cache, bumped one counter and PUT THE WHOLE LIST back to `/api/coupons` — a
// replace-all, fired from a customer's checkout. A visitor whose cache was stale
// or partial replaced the shop's coupons with it.
//
// It was also a second count: `placeOrder` already increments the redemption
// server-side, atomically, against the code the shop itself resolved.

export function getCouponHint(): string {
  return `Try ${getAvailableCouponCodes().slice(0, 3).join(", ")}`;
}

export type { CartTotals };

/**
 * Re-check an already-applied coupon against the current subtotal.
 *
 * A coupon is validated when applied, then carried in the checkout draft. If
 * the customer goes back and empties the cart, that frozen discount would still
 * be subtracted — a 20% coupon on a large cart could wipe out a small one
 * entirely, and `Math.max(total, 0)` would quietly floor the result at zero
 * rather than flag it. Anything holding a coupon must revalidate it against the
 * cart it is actually being applied to.
 *
 * Returns null when the coupon no longer qualifies.
 */
export function revalidateCoupon(
  coupon: AppliedCoupon | undefined,
  cart: CouponCart
): AppliedCoupon | null {
  if (!coupon) return null;
  const result = applyCouponCode(coupon.code, cart);
  return result.ok ? result.coupon : null;
}
