import type { CartLineItem } from "./cart";

/**
 * A copy of the cart lines the SERVER can read, so the cart page arrives
 * already drawn.
 *
 * The cart lives in localStorage, which only the browser can read. So the cart
 * page shipped a skeleton and drew the lines after its JavaScript had loaded
 * and run — on a mid-range phone on 4G that was 4.3s to the first line, and
 * the page jumped as the skeleton turned into the real layout (CLS 0.39, on the
 * one page every order passes through).
 *
 * Scoped to the cart's own path: a cookie is sent with every request to its
 * path, and on the whole site that would add the cart to every image, script
 * and page request a visitor makes. localStorage stays the truth; this is a
 * mirror, written whenever the cart is, and dropped when it would not fit.
 */
export const CART_COOKIE = "bc_cart";
export const CART_COOKIE_PATH = "/store/cart";
/** Browsers cap a cookie near 4 KB; past this the page simply draws as before. */
const MAX_LENGTH = 3800;
const MAX_AGE_S = 60 * 60 * 24 * 30;

export function encodeCartCookie(items: readonly CartLineItem[]): string | null {
  if (items.length === 0) return null;
  const value = encodeURIComponent(JSON.stringify(items));
  return value.length <= MAX_LENGTH ? value : null;
}

const isText = (v: unknown) => typeof v === "string";
const isOptionalText = (v: unknown) => v === undefined || typeof v === "string";

/**
 * The lines in a cookie, or none. Anything the cart page draws is checked for
 * its type — the cookie is the visitor's to edit, and a malformed one must
 * draw the skeleton, not break the page.
 */
export function decodeCartCookie(raw: string | undefined): CartLineItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 50) return [];
    const ok = parsed.every((line) => {
      const l = line as Record<string, unknown>;
      return (
        l &&
        typeof l === "object" &&
        isText(l.id) &&
        isText(l.productSlug) &&
        isText(l.name) &&
        isOptionalText(l.image) &&
        typeof l.price === "number" &&
        Number.isFinite(l.price) &&
        typeof l.quantity === "number" &&
        Number.isInteger(l.quantity) &&
        l.quantity > 0 &&
        (l.variantSummary === undefined || (Array.isArray(l.variantSummary) && l.variantSummary.every(isText)))
      );
    });
    return ok ? (parsed as CartLineItem[]) : [];
  } catch {
    return [];
  }
}

/** Mirror the cart into the cookie — or clear it when empty or too big. */
export function writeCartCookie(items: readonly CartLineItem[]): void {
  if (typeof document === "undefined") return;
  const value = encodeCartCookie(items);
  document.cookie = value
    ? `${CART_COOKIE}=${value}; Path=${CART_COOKIE_PATH}; Max-Age=${MAX_AGE_S}; SameSite=Lax`
    : `${CART_COOKIE}=; Path=${CART_COOKIE_PATH}; Max-Age=0; SameSite=Lax`;
}
