/**
 * A localStorage write that cannot take the page down.
 *
 * `localStorage.setItem` THROWS when the origin's quota is full — about 5 MB in
 * every browser that matters — and this project called it in 118 places without
 * a single try/catch. So one oversized value bricked every other write in the
 * app, and the throw surfaced as a runtime error overlay over whatever the
 * customer or the admin was doing:
 *
 *     QuotaExceededError: Failed to execute 'setItem' on 'Storage':
 *     Setting the value of 'bakery-cms-testimonials' exceeded the quota.
 *
 * The testimonials were 85 KB. They were simply the write that met the wall,
 * and the code that met it was a CACHE REFRESH — hydrating the browser with
 * what the server had just sent. Nothing was lost by that write failing except
 * a copy of data the server still holds; what was lost was the page.
 *
 * WHAT THIS DOES NOT DO is make room. Evicting another key to fit this one
 * would delete somebody's cart, or the address they typed, to cache a list of
 * testimonials — so a full quota means this write does not happen and every
 * other value stays exactly where it is.
 *
 * The boolean is the honest half: a caller holding the user's OWN data (a cart,
 * a wishlist, a saved address) can tell them it did not save. A caller
 * refreshing a cache can ignore it, because the server is the source of truth
 * and the next read fetches again.
 */

/** True when the value was stored. False when it was not, for any reason. */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    /**
     * Every failure, not just the quota. Safari in private mode used to throw
     * on any write at all, a browser set to block site data throws on access,
     * and an extension can replace the whole object — none of which is a reason
     * for a shop's page to stop rendering.
     *
     * Warned rather than swallowed, because a cache that has silently stopped
     * writing is exactly the kind of thing nobody notices for a month.
     */
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[storage] could not write "${key}"`, error);
    }
    return false;
  }
}

/** The same, for a removal. A failed clear must not take a page down either. */
export function safeRemoveItem(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
