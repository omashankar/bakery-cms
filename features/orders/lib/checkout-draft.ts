import type { AppliedCoupon } from "./coupons";

const CHECKOUT_DRAFT_KEY = "bakery-cms-checkout-draft";

/**
 * Which flow wrote this draft.
 *
 * `step` is a bare number in sessionStorage and in the `?step=` URL, and the
 * numbers changed meaning: 2 was the payment screen and is now Personalize, 3
 * was Review and is now Payment. A customer who left a half-finished checkout
 * before a deploy and came back after it would be dropped on a screen they had
 * never filled in, with the one before it silently skipped — and on the old 3,
 * straight onto the screen that takes the money.
 *
 * So the position is trusted only when the writer agreed about what it meant.
 * Everything they typed is kept; only where they were standing is forgotten.
 * Bump this whenever a step is added, removed or reordered.
 */
const CHECKOUT_FLOW_VERSION = 2;

export type PaymentMethod = "cod" | "upi" | "card" | "razorpay";

export interface CheckoutAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * When the order should arrive.
 *
 * Chosen once for the whole order. Individual cart lines can also carry a date
 * picked on the product page, but an order is delivered in one go — so the
 * slot agreed at checkout is what the kitchen and the customer both work to.
 */
export interface DeliverySlot {
  /** ISO date (yyyy-mm-dd) — matches the date input value. */
  date: string;
  /** One of the commerce settings' configured windows, e.g. "2:00 PM – 4:00 PM". */
  timeSlot: string;
}

/** 1 Address · 2 Personalize · 3 Payment. The cart is a route, not a step. */
export type CheckoutStep = 1 | 2 | 3;

export interface CheckoutDraft {
  /** See `CHECKOUT_FLOW_VERSION` — stamped on write, checked on read. */
  version: number;
  step: CheckoutStep;
  address: CheckoutAddress;
  deliverySlot: DeliverySlot;
  paymentMethod: PaymentMethod;
  coupon?: AppliedCoupon;
  orderNotes?: string;
  paymentVerified?: boolean;
  paymentReference?: string;
}

export const EMPTY_CHECKOUT_ADDRESS: CheckoutAddress = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
};

export const EMPTY_DELIVERY_SLOT: DeliverySlot = {
  date: "",
  timeSlot: "",
};

export const DEFAULT_CHECKOUT_DRAFT: CheckoutDraft = {
  version: CHECKOUT_FLOW_VERSION,
  step: 1,
  address: EMPTY_CHECKOUT_ADDRESS,
  deliverySlot: EMPTY_DELIVERY_SLOT,
  paymentMethod: "cod",
};

/** True once the customer has chosen both a date and a window. */
export function hasDeliverySlot(slot?: Partial<DeliverySlot>): boolean {
  return Boolean(slot?.date?.trim() && slot?.timeSlot?.trim());
}

export function getCheckoutDraft(): CheckoutDraft {
  if (typeof window === "undefined") return DEFAULT_CHECKOUT_DRAFT;

  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return DEFAULT_CHECKOUT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    /**
     * A step written by a different flow means nothing here, and neither does
     * a number nobody wrote — `step: 7` used to be spread straight through and
     * would have matched no branch, rendering a checkout with an empty middle.
     */
    const writtenByThisFlow = parsed.version === CHECKOUT_FLOW_VERSION;
    const step: CheckoutStep =
      writtenByThisFlow && (parsed.step === 1 || parsed.step === 2 || parsed.step === 3)
        ? parsed.step
        : 1;

    return {
      ...DEFAULT_CHECKOUT_DRAFT,
      ...parsed,
      version: CHECKOUT_FLOW_VERSION,
      step,
      address: { ...EMPTY_CHECKOUT_ADDRESS, ...parsed.address },
      deliverySlot: { ...EMPTY_DELIVERY_SLOT, ...parsed.deliverySlot },
    };
  } catch {
    return DEFAULT_CHECKOUT_DRAFT;
  }
}

/**
 * The version is NOT a caller's to supply.
 *
 * Every write is by definition this flow's, so asking for it would only create
 * the chance of getting it wrong — and a draft written with a stale version is
 * thrown back to the first screen by the very next read, which for a customer
 * on Payment means being returned to Address by every reload, silently.
 */
export function saveCheckoutDraft(draft: Omit<CheckoutDraft, "version">): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    CHECKOUT_DRAFT_KEY,
    JSON.stringify({ ...draft, version: CHECKOUT_FLOW_VERSION }),
  );
}

export function clearCheckoutDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
}
