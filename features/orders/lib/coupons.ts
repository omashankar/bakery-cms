import {
  getActiveCoupons,
  getCouponByCode,
  incrementCouponUsage,
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
}

/**
 * The one place a discount is decided, given a list of coupons and a subtotal.
 *
 * Pure and list-driven so the SERVER can run it against the coupons in Mongo.
 * Until now this logic only existed against `localStorage`, which meant a coupon
 * was valid because the customer's browser said so — and the order carried a
 * `coupon` object the caller could invent outright, discount included.
 */
export function evaluateCoupon(
  coupons: CouponRule[],
  code: string,
  subtotal: number,
  now = Date.now(),
): { ok: true; coupon: AppliedCoupon } | { ok: false; message: string } {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, message: "Enter a coupon code" };
  }

  const definition = coupons.find((item) => item.code.trim().toUpperCase() === normalized);
  if (!definition || definition.isActive === false) {
    return { ok: false, message: "Invalid coupon code" };
  }

  if (definition.expiresAt && new Date(definition.expiresAt).getTime() < now) {
    return { ok: false, message: "This coupon has expired" };
  }

  if (definition.minSubtotal && subtotal < definition.minSubtotal) {
    return {
      ok: false,
      message: `Minimum order ${definition.minSubtotal.toLocaleString("en-IN")} required`,
    };
  }

  let discountAmount = 0;
  if (definition.percentOff) {
    discountAmount = Math.round(subtotal * (definition.percentOff / 100));
  } else if (definition.flatOff) {
    discountAmount = definition.flatOff;
  }

  discountAmount = Math.min(discountAmount, subtotal);
  if (discountAmount <= 0) {
    return { ok: false, message: "Coupon cannot be applied to this order" };
  }

  return {
    ok: true,
    coupon: { code: definition.code, label: definition.label, discountAmount },
  };
}

/** Server convenience: the applied coupon, or null when it does not hold. */
export function resolveCouponDiscount(
  coupons: CouponRule[],
  code: string,
  subtotal: number,
): AppliedCoupon | null {
  const result = evaluateCoupon(coupons, code, subtotal);
  return result.ok ? result.coupon : null;
}

/** The browser's entry point — same rules, against the local coupon cache. */
export function applyCouponCode(
  code: string,
  subtotal: number
): { ok: true; coupon: AppliedCoupon } | { ok: false; message: string } {
  const normalized = code.trim().toUpperCase();
  const definition = getCouponByCode(normalized);
  return evaluateCoupon(definition ? [definition as CouponRule] : [], normalized, subtotal);
}

export function recordCouponUsage(code: string): Promise<void> {
  return incrementCouponUsage(code);
}

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
  subtotal: number
): AppliedCoupon | null {
  if (!coupon) return null;
  const result = applyCouponCode(coupon.code, subtotal);
  return result.ok ? result.coupon : null;
}
