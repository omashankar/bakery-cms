/**
 * THE CART PAGE ARRIVES DRAWN.
 *
 * The cart lives in localStorage, which only the browser can read, so the page
 * shipped a skeleton and drew the lines once its JavaScript had run: 4.3s to
 * the first line on a mid-range phone, and the page jumped (CLS 0.39) as the
 * skeleton became the layout. A copy of the lines now rides in a cookie scoped
 * to the cart's path, and the server draws them.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CART_COOKIE_PATH, CART_TOO_BIG, cartFromCookie, decodeCartCookie, encodeCartCookie } from "@/features/cart/lib/cart-cookie";
import type { CartLineItem } from "@/features/cart/lib/cart";

const line = (over: Partial<CartLineItem> = {}): CartLineItem => ({
  id: "cake-1",
  productSlug: "chocolate-truffle",
  name: "Chocolate Truffle",
  image: "https://res.cloudinary.com/shop/image/upload/v1/cake.jpg",
  price: 799,
  quantity: 1,
  weight: "1 kg",
  variantSummary: ["Shape: Heart"],
  ...over,
});

describe("the cart cookie", () => {
  it("carries the lines there and back", () => {
    const items = [line(), line({ id: "cake-2", quantity: 2, message: "Happy Birthday, Riya!" })];
    expect(decodeCartCookie(encodeCartCookie(items)!)).toEqual(items);
  });

  it("is not written for an empty cart", () => {
    expect(encodeCartCookie([])).toBeNull();
  });

  it("is not written when it would not fit in a cookie — the page draws as before", () => {
    const many = Array.from({ length: 30 }, (_, i) => line({ id: `cake-${i}`, message: "x".repeat(80) }));
    expect(encodeCartCookie(many)).toBeNull();
  });

  it.each([
    ["missing", undefined],
    ["not JSON", "%7Bnope"],
    ["not a list", encodeURIComponent(JSON.stringify({ id: "x" }))],
    ["a price that is not a number", encodeURIComponent(JSON.stringify([{ ...line(), price: "799" }]))],
    ["a quantity of zero", encodeURIComponent(JSON.stringify([{ ...line(), quantity: 0 }]))],
    ["a name that is not text", encodeURIComponent(JSON.stringify([{ ...line(), name: { html: "<b>" } }]))],
  ])("a cookie that is %s draws the skeleton, not a broken page", (_what, raw) => {
    expect(decodeCartCookie(raw)).toEqual([]);
  });

  it("is sent only to the cart page, not with every request on the site", () => {
    expect(CART_COOKIE_PATH).toBe("/store/cart");
  });
});

describe("where it is written and read", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("every cart write mirrors into the cookie", () => {
    const cart = source("features/cart/lib/cart.ts");
    const writer = cart.slice(cart.indexOf("function writeCart("), cart.indexOf("function writeCart(") + 400);
    expect(writer).toContain("writeCartCookie(items)");
  });

  it("the cart page is drawn from it, and falls back to the skeleton only when the cart is too big to mirror", () => {
    const route = source("app/(storefront)/store/cart/page.tsx");
    expect(route).toContain("cartFromCookie(jar.get(CART_COOKIE)?.value)");
    expect(route).toContain("cartKnown={cartKnown}");
    const page = source("apps/website/pages/cart-page.tsx");
    // The server's lines are what the server and hydrating render draw…
    expect(page).toContain("items: initialItems ?? [],");
    expect(page).toContain("useExternalValue(readCartScreen, cartScreenChanges, serverScreen)");
    expect(page).toContain("{!loaded && items.length === 0 && !cartKnown ? (");
  });

  it("no cookie is an EMPTY cart, drawn at once — a big cart says so and is not mistaken for one", () => {
    // A first visit used to wait for the scripts to learn its cart was empty.
    expect(cartFromCookie(undefined)).toEqual({ items: [], known: true });
    // Lines too big for the cookie: "look in the browser", never "empty".
    expect(cartFromCookie(CART_TOO_BIG)).toEqual({ items: [], known: false });
    const one = [{ id: "a", productSlug: "a", name: "A", price: 100, quantity: 1 }] as CartLineItem[];
    expect(cartFromCookie(encodeCartCookie(one)!)).toEqual({ items: one, known: true });
    // A cookie that does not read is not trusted as empty either.
    expect(cartFromCookie("%7Bnot-json")).toEqual({ items: [], known: false });
  });

  it("a cart too big to mirror writes the marker rather than deleting the cookie", () => {
    const writer = source("features/cart/lib/cart-cookie.ts");
    expect(writer).toContain("(encodeCartCookie(items) ?? CART_TOO_BIG)");
  });
});
