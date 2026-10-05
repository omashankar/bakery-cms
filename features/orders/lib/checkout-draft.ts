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

/** What the customer calls this destination. Set by the Home/Office/Other control. */
export type AddressLabel = "Home" | "Office" | "Other";

export interface CheckoutAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  /**
   * The thing a rider actually navigates by.
   *
   * Kept apart from `addressLine2`, which is a continuation of the street
   * address. Both can be present and they mean different things — "Flat 4B"
   * is not "opposite the water tank".
   */
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  /**
   * Free text, and deliberately not a list.
   *
   * Nothing in this CMS records which country the shop is in — there is no
   * setting for it and no country list anywhere in the repo — so a dropdown
   * here would be this code asserting a country on the shop's behalf.
   */
  country?: string;
  /** A second number to try. Optional everywhere, including on the order. */
  altPhone?: string;
  addressLabel?: AddressLabel;
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
  /**
   * WHICH speed was bought, when the shop sells more than one.
   *
   * The id is what prices it — the amount is looked up in the shop's own
   * settings, never sent by the browser. The label rides along so a stored
   * order can still name the service after the shop renames or deletes the
   * tier, which an id alone cannot do.
   */
  tierId?: string;
  tierLabel?: string;
}

/** 1 Address · 2 Personalize · 3 Payment. The cart is a route, not a step. */
export type CheckoutStep = 1 | 2 | 3;

/** Whoever is sending the order, when that is not whoever receives it. */
export interface OrderSender {
  name: string;
  phone: string;
  /**
   * Keep the sender's name and number off what the recipient is shown.
   *
   * The shop still has both — it has to, to reach the person who paid. This
   * only governs what is printed on the parcel and put in the recipient's
   * messages.
   */
  hideFromRecipient?: boolean;
}

/**
 * Everything the Personalize screen collects, as ONE field.
 *
 * `orderNotes` is a single optional string and it passes through twelve
 * hand-written places — the draft type, the quote request, the quote schema,
 * the controller, the draft repository and its Mongoose model, the placed-order
 * type, the placement schema, the order service, the order model, the webhook's
 * rebuild, and four read-backs. Four more scalars would have been four more
 * trips through all of that, and this repo already has a note recording what
 * happens next: one of the twelve gets missed and the field vanishes in silence.
 *
 * So the screen gets one object. The twelve edits happen once, and the next
 * thing Personalize asks for costs none of them.
 */
export interface OrderPersonalisation {
  /**
   * The shop's own word, taken from what it has tagged its products with —
   * never a fixed Birthday/Anniversary list, which is a claim about what this
   * shop sells and for whom.
   */
  occasion?: string;
  /** For whoever opens the parcel. Not the same as `orderNotes`, which is for the shop. */
  message?: string;
  sender?: OrderSender;
  /** When the shop's terms were accepted, ISO. Absent means they were not. */
  termsAcceptedAt?: string;
}

export interface CheckoutDraft {
  /** See `CHECKOUT_FLOW_VERSION` — stamped on write, checked on read. */
  version: number;
  step: CheckoutStep;
  personalisation?: OrderPersonalisation;
  address: CheckoutAddress;
  deliverySlot: DeliverySlot;
  paymentMethod: PaymentMethod;
  coupon?: AppliedCoupon;
  orderNotes?: string;
  paymentVerified?: boolean;
  paymentReference?: string;
}

/**
 * Every key present, every one a string.
 *
 * This is the floor `getCheckoutDraft` merges a stored address over. A key
 * missing here comes back `undefined` from a draft written before the field
 * existed, and React flips that input from controlled to uncontrolled — which
 * the compiler cannot catch, because all of these are optional.
 */
export const EMPTY_CHECKOUT_ADDRESS: CheckoutAddress = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
  altPhone: "",
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

/**
 * True once the customer has booked a delivery.
 *
 * A date and a window, as it always was — OR a date and a tier that takes no
 * window. Not every speed has one: a midnight or a next-day delivery has
 * nothing to choose, and requiring a window there left the customer on a
 * screen whose Continue button could not be satisfied by anything on it.
 *
 * A shop with no tiers configured is unaffected, because no slot it writes
 * carries a `tierId`.
 */
export function hasDeliverySlot(slot?: Partial<DeliverySlot>): boolean {
  if (!slot?.date?.trim()) return false;
  return Boolean(slot.timeSlot?.trim() || slot.tierId?.trim());
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
