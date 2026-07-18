import type { AppliedCoupon } from "./coupons";

const CHECKOUT_DRAFT_KEY = "bakery-cms-checkout-draft";

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

export interface CheckoutDraft {
  step: 1 | 2 | 3;
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
    const parsed = JSON.parse(raw) as CheckoutDraft;
    return {
      ...DEFAULT_CHECKOUT_DRAFT,
      ...parsed,
      address: { ...EMPTY_CHECKOUT_ADDRESS, ...parsed.address },
      deliverySlot: { ...EMPTY_DELIVERY_SLOT, ...parsed.deliverySlot },
    };
  } catch {
    return DEFAULT_CHECKOUT_DRAFT;
  }
}

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
}

export function clearCheckoutDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
}
