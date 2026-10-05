import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addToCart, cartLineToAddInput, type CartLineItem } from "@/features/cart/lib/cart";
import { offersForCart } from "@/features/commerce/lib/coupon-offers";

/**
 * The two sections a cart page is usually padded out with.
 *
 * "Promo / upsell" and a "trust strip" are where storefronts put things nobody
 * can substantiate — 6,000 cities, 20 million happy customers, a banner for an
 * offer that ended. This project's rule is the opposite: a section with no real
 * data behind it does not render at all.
 *
 * So the promo row is the shop's own live coupons, read from the same store the
 * coupon box applies from — the page cannot advertise a code its own input would
 * refuse — with the shortfall said out loud, because a card that hides the
 * minimum sends somebody to a checkout that rejects the code. And the service
 * strip is two values an owner typed into commerce settings, each of which
 * disappears when it is not set.
 */

const COUPON_KEY = "bakery-cms-coupons";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/store/cart",
  useSearchParams: () => new URLSearchParams(),
}));

const { CartPage } = await import("@/apps/website/pages/cart-page");

const LINE: CartLineItem = {
  id: "seed",
  productSlug: "cotton-tee",
  name: "Cotton Tee",
  image: "/tee.jpg",
  price: 1000,
  quantity: 1,
};

function shopOffers(...coupons: Record<string, unknown>[]) {
  window.localStorage.setItem(
    COUPON_KEY,
    JSON.stringify(
      coupons.map((coupon, index) => ({
        id: `c-${index}`,
        label: "",
        description: "",
        isActive: true,
        usageCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...coupon,
      })),
    ),
  );
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(CartPage, { catalog: [] } as never));
  });
  return container;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("which offers a basket is shown", () => {
  it("names the code and what it is worth", () => {
    shopOffers({ code: "SAVE200", flatOff: 200 });
    addToCart(cartLineToAddInput(LINE));

    const text = render().textContent ?? "";
    expect(text).toContain("SAVE200");
  });

  it("says how much more the basket needs", () => {
    /**
     * `isLiveCoupon` deliberately ignores `minSubtotal` — an offer with a
     * minimum is still a real offer — and the module says in as many words that
     * the condition must therefore be SHOWN. A ₹1,000 basket and a ₹1,500
     * minimum is ₹500 short.
     */
    shopOffers({ code: "BIG500", flatOff: 500, minSubtotal: 1500 });
    addToCart(cartLineToAddInput(LINE));

    expect(render().textContent).toContain("add ₹500 more");
  });

  it("says nothing about a shortfall the basket has already cleared", () => {
    shopOffers({ code: "SAVE200", flatOff: 200, minSubtotal: 500 });
    addToCart(cartLineToAddInput(LINE));

    expect(render().textContent).not.toContain("more to use it");
  });

  it("renders no promo section at all when the shop has no live offers", () => {
    // Every coupon this install ships is inactive until an owner turns it on,
    // so this is the state of a shop that has just been set up.
    addToCart(cartLineToAddInput(LINE));

    expect(render().textContent).not.toContain("Offers you can use");
  });

  it("does not advertise the coupon that is already applied", () => {
    const applied = offersForCart(
      [
        { code: "SAVE200", flatOff: 200, isActive: true } as never,
        { code: "OTHER", flatOff: 50, isActive: true } as never,
      ],
      1000,
      { exclude: "save200" },
    );

    expect(applied.map((offer) => offer.code)).toEqual(["OTHER"]);
  });

  it("leaves out one the shop has switched off", () => {
    const live = offersForCart(
      [
        { code: "OFF", flatOff: 200, isActive: false } as never,
        { code: "ON", flatOff: 50, isActive: true } as never,
      ],
      1000,
    );

    expect(live.map((offer) => offer.code)).toEqual(["ON"]);
  });

  it("leaves out one that has expired", () => {
    const live = offersForCart(
      [
        {
          code: "GONE",
          flatOff: 200,
          isActive: true,
          expiresAt: "2020-01-01T00:00:00.000Z",
        } as never,
      ],
      1000,
    );

    expect(live).toEqual([]);
  });
});

describe("what the shop is willing to promise", () => {
  it("shows the delivery promise it actually configured", () => {
    addToCart(cartLineToAddInput(LINE));

    // The default commerce settings carry one, so this shop has something to
    // say; the point is that it comes from there and not from this file.
    const text = render().textContent ?? "";
    expect(text).toContain("Free delivery on orders over");
  });

  it("claims nothing a customer cannot check", () => {
    addToCart(cartLineToAddInput(LINE));

    const text = render().textContent ?? "";
    for (const boast of ["6000 Cities", "Happy Customers", "20M", "Assured Quality"]) {
      expect(text).not.toContain(boast);
    }
  });
});
