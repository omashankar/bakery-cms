import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addToCart,
  cartLineToAddInput,
  getCartItems,
  type CartLineItem,
} from "@/features/cart/lib/cart";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { getCheckoutDraft } from "@/features/orders/lib/checkout-draft";
import { evaluateCoupon } from "@/features/orders/lib/coupons";
import { formatCurrency } from "@/utils/format";

/**
 * The cart could not take a coupon, and the total it showed was not the one the
 * customer would pay.
 *
 * A whole coupon system already existed — one rule engine shared by the browser
 * and the server, a component, a draft to carry the chosen code, and a
 * redemption counter that fires server-side inside `placeOrder` — and every bit
 * of it was reachable only from the checkout page. So the screen where a
 * customer decides whether to buy at all could not answer the question they were
 * deciding on.
 *
 * The rule this file exists to hold: the cart uses THAT system. A coupon box of
 * its own would be a second source of truth for the one field on the page that
 * changes what is charged, and the two would drift the first time either moved.
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

/** One live coupon in this browser's cache, which is what `applyCouponCode` reads. */
function shopOffers(coupon: Record<string, unknown>) {
  window.localStorage.setItem(
    COUPON_KEY,
    JSON.stringify([
      {
        id: "c-1",
        label: "₹200 off",
        description: "",
        isActive: true,
        usageCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...coupon,
      },
    ]),
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

function type(value: string) {
  const input = container?.querySelector('input[placeholder="Coupon code"]') as
    | HTMLInputElement
    | undefined;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function press(text: string) {
  const button = [...(container?.querySelectorAll("button") ?? [])].find(
    (node) => node.textContent?.trim() === text,
  );
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return button;
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

describe("applying a coupon on the cart", () => {
  it("takes the money off the total the cart is showing", async () => {
    shopOffers({ code: "SAVE200", flatOff: 200 });
    addToCart(cartLineToAddInput(LINE));

    const view = render();
    type("SAVE200");
    press("Apply");
    // `CouponInput` waits before answering, deliberately.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(view.textContent).toContain("SAVE200");

    /**
     * THE TOTAL, not the chip.
     *
     * An earlier version of this test asserted only that "SAVE200" and "₹200"
     * appeared — and both come from the applied-coupon chip alone, whose label
     * in this fixture is literally "₹200 off". It passed whether or not a
     * single rupee came off anything, which is the one thing it is named for.
     */
    const withDiscount = formatCurrency(
      calculateCartTotals({ items: getCartItems(), discount: 200 }).total,
    );
    const withoutDiscount = formatCurrency(calculateCartTotals({ items: getCartItems() }).total);
    expect(withDiscount).not.toBe(withoutDiscount);
    expect(view.textContent).toContain(withDiscount);
    expect(view.textContent).not.toContain(withoutDiscount);
  });

  it("writes it where checkout will read it, and nowhere else", async () => {
    /**
     * One place a chosen code lives: the checkout draft. If the cart kept its
     * own copy, a customer who applied a coupon here and went forward would
     * either lose it or carry two.
     */
    shopOffers({ code: "SAVE200", flatOff: 200 });
    addToCart(cartLineToAddInput(LINE));

    render();
    type("SAVE200");
    press("Apply");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(getCheckoutDraft().coupon?.code).toBe("SAVE200");
  });

  it("gives it back when the customer removes it", async () => {
    shopOffers({ code: "SAVE200", flatOff: 200 });
    addToCart(cartLineToAddInput(LINE));

    render();
    type("SAVE200");
    press("Apply");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    press("Remove");

    expect(getCheckoutDraft().coupon).toBeUndefined();
  });
});

describe("a coupon that stopped applying", () => {
  it("says so, and stops taking the money off", () => {
    /**
     * The draft carries the code, and carts get edited. A frozen ₹200 off a
     * cart that has since dropped below the minimum would subtract money the
     * shop never agreed to — and `Math.max(total, 0)` would floor the damage at
     * zero rather than show it.
     */
    shopOffers({ code: "BIG200", flatOff: 200, minSubtotal: 5000 });
    window.sessionStorage.setItem(
      "bakery-cms-checkout-draft",
      JSON.stringify({
        step: 1,
        address: {},
        deliverySlot: { date: "", timeSlot: "" },
        paymentMethod: "cod",
        coupon: { code: "BIG200", label: "₹200 off", discountAmount: 200 },
      }),
    );
    addToCart(cartLineToAddInput(LINE));

    const text = render().textContent ?? "";

    expect(text).toContain("BIG200 no longer applies");
    // …and it says what would bring it back, in the shop's own money.
    expect(text).toContain("Minimum order");

    /**
     * THE HALF THAT IS ABOUT MONEY. Saying it lapsed while still subtracting
     * the ₹200 would be worse than saying nothing: the customer is quoted a
     * total the shop will not honour, and the reconciliation happens at the
     * payment step or not at all. Asserted as a NUMBER, because the chip and
     * the arithmetic are two different pieces of code.
     */
    const undiscounted = formatCurrency(calculateCartTotals({ items: getCartItems() }).total);
    expect(text).toContain(undiscounted);
    expect(text).not.toContain("Discount");
  });
});

describe("the minimum-order refusal", () => {
  it("is written in the shop's currency, not India's", () => {
    /**
     * This read `toLocaleString("en-IN")` — Indian digit grouping, no symbol —
     * three lines above a `currency` argument the same function already takes
     * and uses correctly for the discount itself. A dollar shop refused a
     * coupon with "Minimum order 1,500 required", and the customer had to guess
     * which 1,500.
     */
    const result = evaluateCoupon(
      [{ code: "BIG", label: "", description: "", flatOff: 100, minSubtotal: 1500 } as never],
      "BIG",
      100,
      Date.now(),
      "USD",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("$");
      expect(result.message).not.toBe("Minimum order 1,500 required");
    }
  });
});

describe("the bar that follows the customer down the page", () => {
  it("carries the total and the way forward while there is a cart", () => {
    /**
     * The summary is `lg:sticky` in the right-hand column, which does nothing on
     * a phone: it sits below the lines, the extras, saved-for-later and a rail
     * of recently viewed. A customer could not see what their cart came to
     * without scrolling to the end of the page.
     */
    addToCart(cartLineToAddInput(LINE));

    const view = render();
    const bar = view.querySelector(".fixed.inset-x-0.bottom-0");
    expect(bar?.textContent).toContain("Proceed to checkout");
    // The SAME number the summary panel shows — delivery, tax and charges
    // included — not the subtotal. Two totals on one screen is the bug this
    // bar would otherwise introduce.
    const total = formatCurrency(
      calculateCartTotals({ items: getCartItems() }).total,
    );
    expect(bar?.textContent).toContain(total);
    expect(view.textContent?.split(total).length, "the bar and the panel disagree").toBeGreaterThan(2);
  });

  it("is not there when there is nothing to check out", () => {
    expect(render().querySelector(".fixed.inset-x-0.bottom-0")).toBeNull();
  });

  it("states a saving only where the shop stated a higher price", () => {
    addToCart(cartLineToAddInput({ ...LINE, compareAtPrice: 1200, quantity: 2 }));

    // 2 x (1,200 - 1,000).
    expect(render().textContent).toContain("You save ₹400");
  });

  it("invents no saving at all otherwise", () => {
    addToCart(cartLineToAddInput(LINE));

    expect(render().textContent).not.toContain("You save");
  });

  it("counts only the lines the shop actually priced higher", () => {
    /**
     * The realistic cart: one thing on offer, one thing not. Summing without
     * the per-line guard turns the second line into `undefined - price`, and a
     * single NaN makes the whole figure disappear — so the shop's one real
     * offer stops being mentioned the moment anything else is added beside it.
     */
    addToCart(cartLineToAddInput({ ...LINE, compareAtPrice: 1200 }));
    addToCart(
      cartLineToAddInput({
        ...LINE,
        productSlug: "plain-tee",
        name: "Plain Tee",
        price: 500,
      }),
    );

    expect(render().textContent).toContain("You save ₹200");
  });
});
