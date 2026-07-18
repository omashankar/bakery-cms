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

export interface CheckoutDraft {
  step: 1 | 2 | 3;
  address: CheckoutAddress;
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

export const DEFAULT_CHECKOUT_DRAFT: CheckoutDraft = {
  step: 1,
  address: EMPTY_CHECKOUT_ADDRESS,
  paymentMethod: "cod",
};

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
