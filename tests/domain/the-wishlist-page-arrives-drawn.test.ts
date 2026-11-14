/**
 * THE WISHLIST PAGE ARRIVES DRAWN.
 *
 * The saved list lives in localStorage, so the page waited for its scripts
 * before it could say anything — "Your wishlist is empty" was the page's LCP
 * at 4.1–5.0s on a throttled phone. A copy in a cookie lets the server draw
 * it. These pin the two halves: the copy never falls behind the list, and a
 * cookie the server cannot trust draws the skeleton rather than a wrong page.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  WISHLIST_COOKIE,
  WISHLIST_TOO_BIG,
  encodeWishlistCookie,
  wishlistFromCookie,
} from "@/apps/website/lib/wishlist-cookie";
import { addToWishlist, pruneWishlist, syncWishlistCookie, toggleWishlist } from "@/apps/website/lib/wishlist";

/** The cookie as the browser would send it to /store/wishlist. */
function cookieValue(): string | undefined {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${WISHLIST_COOKIE}=`));
  return hit ? hit.slice(WISHLIST_COOKIE.length + 1) : undefined;
}

function clearCookie() {
  document.cookie = `${WISHLIST_COOKIE}=; Path=/store/wishlist; Max-Age=0`;
}

beforeEach(() => {
  localStorage.clear();
  clearCookie();
  // jsdom only returns cookies for the current path, as a browser does.
  window.history.replaceState(null, "", "/store/wishlist");
});

describe("the copy the server reads", () => {
  it("round-trips the saved slugs", () => {
    const raw = encodeWishlistCookie(["red-velvet-cake", "black-forest"]);
    expect(wishlistFromCookie(raw ?? undefined)).toEqual({ slugs: ["red-velvet-cake", "black-forest"], known: true });
  });

  it("is no cookie at all for an empty list, which the server reads as empty", () => {
    expect(encodeWishlistCookie([])).toBeNull();
    expect(wishlistFromCookie(undefined)).toEqual({ slugs: [], known: true });
  });

  it("says 'look in the browser' when the list will not fit", () => {
    const many = Array.from({ length: 200 }, (_, i) => `a-very-long-product-slug-number-${i}`);
    expect(encodeWishlistCookie(many)).toBe(WISHLIST_TOO_BIG);
    expect(wishlistFromCookie(WISHLIST_TOO_BIG).known).toBe(false);
  });

  it("does not trust a cookie someone edited", () => {
    expect(wishlistFromCookie("<script>").known).toBe(false);
    expect(wishlistFromCookie("ok-slug,%E0%A4%A").known).toBe(false);
    expect(wishlistFromCookie("ok-slug,has space").known).toBe(false);
  });
});

describe("every change to the list reaches the copy", () => {
  it("follows add, toggle and prune", () => {
    addToWishlist("red-velvet-cake");
    expect(wishlistFromCookie(cookieValue()).slugs).toEqual(["red-velvet-cake"]);

    toggleWishlist("black-forest");
    expect(wishlistFromCookie(cookieValue()).slugs).toEqual(["red-velvet-cake", "black-forest"]);

    pruneWishlist(["black-forest"]);
    expect(wishlistFromCookie(cookieValue()).slugs).toEqual(["black-forest"]);

    toggleWishlist("black-forest");
    expect(cookieValue()).toBeUndefined();
  });

  it("catches up with a list saved before the copy existed, or cleared behind its back", () => {
    localStorage.setItem("bakery-cms-wishlist", JSON.stringify(["fruit-cake"]));
    expect(cookieValue()).toBeUndefined();
    syncWishlistCookie();
    expect(wishlistFromCookie(cookieValue()).slugs).toEqual(["fruit-cake"]);

    // Sign-out removes the key directly.
    localStorage.removeItem("bakery-cms-wishlist");
    syncWishlistCookie();
    expect(cookieValue()).toBeUndefined();
  });
});
