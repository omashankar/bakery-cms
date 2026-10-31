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

import { CART_COOKIE_PATH, decodeCartCookie, encodeCartCookie } from "@/features/cart/lib/cart-cookie";
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

  it("the cart page is drawn from it, and only falls back to the skeleton without one", () => {
    const route = source("app/(storefront)/store/cart/page.tsx");
    expect(route).toContain("decodeCartCookie(jar.get(CART_COOKIE)?.value)");
    const page = source("apps/website/pages/cart-page.tsx");
    expect(page).toContain("useState<CartLineItem[]>(() => initialItems ?? [])");
    expect(page).toContain("{!loaded && items.length === 0 ? (");
  });
});
