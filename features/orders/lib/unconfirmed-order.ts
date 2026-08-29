import { ORDERS_STORAGE_KEY, type PlacedOrder } from "./orders";

/**
 * A payment the bakery never acknowledged, kept where a reload cannot erase it.
 *
 * The checkout overlay that tells the customer about one used to live in React
 * state and nowhere else. So a reload — or the phone locking, or a stray Back,
 * or the tab being restored — wiped it, while the cart and the checkout draft
 * both survived. Checkout came back looking entirely ordinary and offered to
 * take the money a second time.
 *
 * Nothing on the server stops that. Placement de-duplicates on the order id and
 * on the captured payment reference, and a fresh attempt has neither in common
 * with the first: it opens its own Razorpay order and gets its own reference.
 * The customer is charged twice, for one cake.
 *
 * Only PAID holds are stored. A cash order that failed to reach the shop has
 * cost nobody anything — the cart is still full and placing it again is the
 * right thing to do — so blocking that customer behind an overlay across every
 * later visit would be the more annoying bug.
 */
const UNCONFIRMED_ORDER_KEY = "bakery-cms-unconfirmed-order";

/**
 * Past this, stop blocking checkout.
 *
 * By then the Razorpay webhook has long since placed the order or the payment
 * has been refunded, and support is the only useful path. A hold that never
 * expired would lock a customer out of the shop over a payment that was
 * resolved days ago.
 */
const UNCONFIRMED_TTL_MS = 24 * 60 * 60 * 1000;

export interface UnconfirmedOrder {
  order: PlacedOrder;
  paymentStatus: "paid" | "cod";
  paymentReference?: string;
  /**
   * The priced cart it was placed against. The retry cannot succeed without it
   * — the shop refuses a card payment with no draft behind it.
   */
  draftId?: string;
  /** The shop's maintenance notice, when that is why it could not be confirmed. */
  closed?: string;
  /** When this was held, so it can be given up on. */
  heldAt: string;
}

export function readUnconfirmedOrder(): UnconfirmedOrder | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(UNCONFIRMED_ORDER_KEY);
    if (!raw) return null;

    const held = JSON.parse(raw) as UnconfirmedOrder;
    // A shape we cannot use is worse than none: the overlay would block
    // checkout while showing an order number it does not have.
    if (!held?.order?.orderNumber) {
      localStorage.removeItem(UNCONFIRMED_ORDER_KEY);
      return null;
    }

    const age = Date.now() - new Date(held.heldAt).getTime();
    if (!Number.isFinite(age) || age > UNCONFIRMED_TTL_MS) {
      localStorage.removeItem(UNCONFIRMED_ORDER_KEY);
      return null;
    }

    return held;
  } catch {
    return null;
  }
}

export function saveUnconfirmedOrder(held: Omit<UnconfirmedOrder, "heldAt">): void {
  if (typeof window === "undefined") return;
  // Cash costs nothing to re-place. See the note at the top of this file.
  if (held.paymentStatus !== "paid" && !held.paymentReference) return;

  const payload = JSON.stringify({ ...held, heldAt: new Date().toISOString() });

  try {
    localStorage.setItem(UNCONFIRMED_ORDER_KEY, payload);
  } catch {
    /**
     * This is a record of money that has ALREADY left the customer's account,
     * and the reference in it is the only thing tying them to an order the shop
     * is holding under a number they have never seen. It is worth more than
     * anything else this origin stores.
     *
     * So make room and try again. The order cache is a convenience the next
     * hydration rebuilds from the server; this is not.
     */
    try {
      localStorage.removeItem(ORDERS_STORAGE_KEY);
      localStorage.setItem(UNCONFIRMED_ORDER_KEY, payload);
    } catch {
      // Storage is refusing everything. The overlay still holds it in React
      // state for this pageview, which is all that is left to offer.
    }
  }
}

export function clearUnconfirmedOrder(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(UNCONFIRMED_ORDER_KEY);
}
