/**
 * Writing to localStorage without letting it break the page.
 *
 * `setItem` throws — for a quota that is full, for a browser with site data
 * blocked, for Safari's private mode. Every store in this app treats
 * localStorage as a CACHE of something the server owns, so a refused write
 * should cost the next reload a round trip and nothing else.
 *
 * It was costing more than that. `placeOrder` wrote its local copy before
 * calling the server, so a full browser threw before the order was ever sent:
 * Razorpay had captured, the shop had no order, and the customer was shown
 * "Payment failed — Setting the value of 'bakery-cms-orders' exceeded the
 * quota". Pressing Retry hit the same wall and could charge them again.
 *
 * Callers that have something better to do than give up — dropping older
 * entries, or freeing another key first — should catch for themselves; this is
 * for the ones whose honest answer is "then not this time".
 */

/** Returns whether the value was stored. Never throws. */
export function writeLocal(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** The same, for a value that has to be serialised first. */
export function writeLocalJson(key: string, value: unknown): boolean {
  try {
    return writeLocal(key, JSON.stringify(value));
  } catch {
    // A circular structure, or a BigInt. Not a storage problem, but the caller
    // wanted a cache write and this is still "it did not happen".
    return false;
  }
}
