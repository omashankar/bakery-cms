import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addToCart, cartLineToAddInput, type CartLineItem } from "@/features/cart/lib/cart";

/**
 * The cart page had no test that rendered it, and no idea where the customer
 * was.
 *
 * The checkout flow has a progress bar and it started at Delivery — so the
 * screen a customer spends the longest on showed no progress at all, and the
 * first thing the next screen told them was that they were at the beginning.
 * The cart IS a step.
 *
 * The shop owner asked for "Cart → Address → Personalize → Payment" and, in the
 * same breath, said not to fake a step this project does not have. It does not
 * have Personalize: a message on the cake, an uploaded photo and gift wrap are
 * controls on the product page and in the cart, not screens. So the bar says
 * what is true — Cart, Delivery, Payment, Review — and this file holds it to
 * that.
 */

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
  price: 849,
  quantity: 2,
  weight: "L",
  weightLabel: "Size",
  variantSelections: { "g-colour": "black" },
  variantSummary: ["Colour: Black"],
};

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

describe("the progress bar on the cart", () => {
  it("says the customer is at the cart, and names the steps that really follow", () => {
    addToCart(cartLineToAddInput(LINE));
    const view = render();
    const text = view.textContent ?? "";

    expect(text).toContain("Cart");
    expect(text).toContain("Delivery");
    expect(text).toContain("Payment");
    expect(text).toContain("Review");

    const current = view.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain("Cart");
  });

  it("does not invent a step this checkout does not have", () => {
    /**
     * The owner named "Personalize" and asked to be told if it was not real. It
     * is not: there is no route, no step value and no screen for it. A circle
     * that never lights up is a promise the flow cannot keep.
     */
    addToCart(cartLineToAddInput(LINE));

    expect(render().textContent ?? "").not.toContain("Personalize");
  });

  it("shows no progress bar over an empty cart", () => {
    // A checkout bar above an empty cart implies a checkout that is not
    // happening. The empty branch shows the message and the way back, only.
    const view = render();

    expect(view.textContent ?? "").toContain("Your cart is empty");
    expect(view.querySelector('[aria-current="step"]')).toBeNull();
    // Not "Review": the page description already says "Review your items",
    // so asserting on that word would pass for a rendered stepper too.
    expect(view.textContent ?? "").not.toContain("Payment");
  });
});

describe("the cart heading", () => {
  it("counts what is actually in the cart", () => {
    // Two of one thing is two items to a customer — and it is the number the
    // navbar badge already shows, so the header and the page agree.
    addToCart(cartLineToAddInput(LINE));

    expect(render().textContent ?? "").toContain("Shopping Cart (2)");
  });

  it("counts nothing when there is nothing", () => {
    expect(render().textContent ?? "").not.toContain("Shopping Cart (");
  });
});
