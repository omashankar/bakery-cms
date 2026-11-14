/**
 * A copy of the saved slugs the SERVER can read, so the wishlist page arrives
 * already drawn.
 *
 * The wishlist lives in localStorage, which only the browser can read, so the
 * page shipped a skeleton and drew either the cards or "Your wishlist is
 * empty" after its scripts had run — measured on a throttled phone, that line
 * was the page's LCP at 4.1–5.0s. The cart solved the same problem the same
 * way (features/cart/lib/cart-cookie.ts).
 *
 * Scoped to the wishlist's own path, so it does not ride along on every
 * request the visitor makes. localStorage stays the truth; this is a mirror.
 * No cookie means an empty wishlist; `big` means "too many to mirror, look in
 * the browser".
 */
export const WISHLIST_COOKIE = "bc_wl";
export const WISHLIST_COOKIE_PATH = "/store/wishlist";
export const WISHLIST_TOO_BIG = "big";
/** Browsers cap a cookie near 4 KB. */
const MAX_LENGTH = 3800;
const MAX_AGE_S = 60 * 60 * 24 * 30;
/** What a slug can be — anything else in a cookie is someone else's text. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;

export function encodeWishlistCookie(slugs: readonly string[]): string | null {
  if (slugs.length === 0) return null;
  const value = slugs.map(encodeURIComponent).join(",");
  return value.length <= MAX_LENGTH ? value : WISHLIST_TOO_BIG;
}

/**
 * What the server may say about this browser's wishlist before any script
 * runs: its slugs, or "unknown" (too big to mirror — draw the skeleton).
 * The cookie is the visitor's to edit, so a malformed one is "unknown", never
 * a broken page.
 */
export function wishlistFromCookie(raw: string | undefined): { slugs: string[]; known: boolean } {
  if (raw === undefined || raw === "") return { slugs: [], known: true };
  if (raw === WISHLIST_TOO_BIG) return { slugs: [], known: false };
  try {
    const slugs = raw.split(",").map(decodeURIComponent);
    if (slugs.length > 200 || !slugs.every((s) => SLUG.test(s))) return { slugs: [], known: false };
    return { slugs, known: true };
  } catch {
    return { slugs: [], known: false };
  }
}

/** Mirror the wishlist into the cookie — or clear it when empty. */
export function writeWishlistCookie(slugs: readonly string[]): void {
  if (typeof document === "undefined") return;
  const value = encodeWishlistCookie(slugs);
  document.cookie = value
    ? `${WISHLIST_COOKIE}=${value}; Path=${WISHLIST_COOKIE_PATH}; Max-Age=${MAX_AGE_S}; SameSite=Lax`
    : `${WISHLIST_COOKIE}=; Path=${WISHLIST_COOKIE_PATH}; Max-Age=0; SameSite=Lax`;
}
