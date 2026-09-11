import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * same breath, said not to fake a step this project does not have. At the time
 * it did not have Personalize — a message, an uploaded photo and gift wrap were
 * controls on the product page and in the cart, not screens — so this file held
 * the bar to Cart, Delivery, Payment, Review.
 *
 * It is a screen now. When the order should arrive is asked there, and Payment
 * absorbed Review: confirming what you are about to pay for was never worth a
 * screen of its own, and the details read back beside the money where they can
 * still be changed. So the bar says the four the owner named.
 *
 * The rule the old test was really protecting survives, and is what the second
 * test below now checks: a circle may only carry a name the flow can actually
 * take the customer to. It is checked against the step machine rather than
 * against a list, so a fifth label cannot be added without a screen behind it.
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
    expect(text).toContain("Address");
    expect(text).toContain("Personalize");
    expect(text).toContain("Payment");

    /**
     * Scoped to the BAR, not the page. The cart's own subtitle opens "Review
     * your items…", so a page-wide search for the retired label passes on a
     * sentence that has nothing to do with the flow.
     */
    const bar = view.querySelector("ol");
    expect(bar?.textContent).not.toContain("Review");

    const current = view.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain("Cart");
  });

  it("names only steps the flow can actually reach", () => {
    /**
     * The rule the owner set — do not draw a circle for a screen that is not
     * there — checked against the machine rather than against a list of words.
     *
     * The bar's ids beyond the cart are the checkout's own step values, so a
     * fifth circle would have to be a fourth `step === n` branch on the
     * checkout page before this passes.
     */
    const bar = readFileSync(
      join(process.cwd(), "apps/website/checkout/components/checkout-progress.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "apps/website/checkout/pages/checkout-page.tsx"),
      "utf8",
    );

    const circles = [...bar.matchAll(/\{ id: (\d+), label: "([^"]+)" \}/g)];
    expect(circles.length, "the bar's own step list").toBe(4);

    for (const [, id, label] of circles) {
      if (id === "0") continue; // the cart is a route, not a step of the form
      expect(page, `${label} is drawn but ${id} is not a screen`).toContain(
        `{step === ${id} ? (`,
      );
    }
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
