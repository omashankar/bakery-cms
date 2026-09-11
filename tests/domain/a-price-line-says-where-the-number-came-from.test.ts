import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { compareAtSavings } from "@/features/orders/lib/cart-totals";
import { TaxBreakdown, taxBreakdownFromCartTotals } from "@/components/shared/tax-breakdown";
import type { CartLineItem } from "@/features/cart/lib/cart";

/**
 * MRP IS A CLAIM ABOUT THE PAST, AND ONLY THE SHOP CAN MAKE IT.
 *
 * The reference checkout heads its rail "Price Details (2 Items)" and opens
 * with an MRP total and an MRP discount. Copying that shape is easy; copying it
 * honestly is the whole job, because this repo has already had an invented MRP
 * taken out of it once — `price > 1000 ? price * 1.1 : undefined` in the
 * product repository, which wore a permanent "9% OFF" against a price no
 * customer had ever been charged.
 *
 * So the pair is derived from `compareAtPrice`, which the shop types, and it is
 * not rendered at all when there is none: an MRP total sitting beside an
 * identical subtotal is a saving of zero dressed as a discount.
 *
 * The formula also lived in the cart page and was about to be copied into the
 * summary panel. One copy, so the savings line and the discount row can never
 * disagree about what a customer saved.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    id: "line-1",
    productSlug: "cotton-tee",
    name: "Cotton Tee",
    image: "",
    price: 800,
    quantity: 1,
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

/** The rows as a customer actually sees them, for a given saving. */
function renderBreakdown(savings: number) {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(TaxBreakdown, {
        values: taxBreakdownFromCartTotals(TOTALS, { compareAtSavings: savings }),
      }),
    );
  });
  return container;
}

const TOTALS = {
  subtotal: 1600,
  delivery: 0,
  tax: 0,
  discount: 0,
  platformCharge: 0,
  giftWrapFee: 0,
  deliveryTierFee: 0,
  total: 1600,
  itemCount: 2,
};

describe("what a customer saved comes from what the shop typed", () => {
  it("counts a compare-at price the shop set, times the quantity", () => {
    expect(compareAtSavings([line({ compareAtPrice: 1000, quantity: 2 })])).toBe(400);
  });

  it("counts nothing where the shop set none", () => {
    expect(compareAtSavings([line(), line({ id: "line-2" })])).toBe(0);
  });

  it("and refuses a compare-at price that is not above what is charged", () => {
    /**
     * A struck-through number lower than the price is not a saving, and
     * rendering it would show a negative discount.
     */
    expect(compareAtSavings([line({ price: 800, compareAtPrice: 700 })])).toBe(0);
    expect(compareAtSavings([line({ price: 800, compareAtPrice: 800 })])).toBe(0);
  });
});

describe("the MRP pair replaces the subtotal, and only when it is real", () => {
  it("states the old total and the discount, which add back to the subtotal", () => {
    const values = taxBreakdownFromCartTotals(TOTALS, { compareAtSavings: 400 });

    expect(values.compareAtSavings).toBe(400);
    expect(values.subtotal + (values.compareAtSavings ?? 0)).toBe(2000);
  });

  it("is not rendered when the shop typed no compare-at price", () => {
    // Guarded on the value, so a shop with none gets the Subtotal row it
    // always had rather than "MRP total" beside an identical number.
    const breakdown = read("components/shared/tax-breakdown.tsx");

    expect(breakdown).toContain("const showMrp = savings > 0;");
    expect(breakdown).toContain('<Row label="Subtotal"');
  });

  it("does not print the subtotal twice", () => {
    /**
     * MRP total and MRP discount add up to the subtotal, so printing all
     * three is the same number said twice. Rendered rather than read as
     * source: a source check passes for a stray Subtotal row added ABOVE an
     * intact ternary, which is exactly how this would come back.
     */
    const withMrp = renderBreakdown(400).textContent ?? "";
    expect(withMrp).toContain("MRP total");
    expect(withMrp).toContain("MRP discount");
    expect(withMrp).not.toContain("Subtotal");

    const without = renderBreakdown(0).textContent ?? "";
    expect(without).toContain("Subtotal");
    expect(without).not.toContain("MRP");
  });
});

describe("one formula, so the two places agree", () => {
  it("is not copied into the cart page or the summary panel", () => {
    /**
     * The cart's "You save ₹470 on this order" line and the rail's MRP
     * discount row are the same claim. Two copies of the arithmetic is how
     * they come to disagree.
     */
    for (const path of [
      "apps/website/pages/cart-page.tsx",
      "apps/website/checkout/components/order-summary-panel.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("compareAtSavings(items)");
      expect(source, path).not.toContain("item.compareAtPrice - item.price");
    }
  });
});

describe("the rail counts what it is summarising", () => {
  it("heads itself with the number of items, from the lines it lists", () => {
    /**
     * "Order Summary" left a customer to count the rows themselves to check
     * nothing had been dropped. Counted from `items` rather than
     * `totals.itemCount`, so the heading and the list under it cannot
     * disagree.
     */
    const panel = read("apps/website/checkout/components/order-summary-panel.tsx");

    expect(panel).toContain("items.reduce((sum, item) => sum + item.quantity, 0)");
    expect(panel).toContain("Price details ({itemCount} item");
    expect(panel).not.toContain(">Order Summary<");
  });
});

describe("the read-back has a way back", () => {
  const page = read("apps/website/checkout/pages/checkout-page.tsx");

  it("gives every block that can be changed a link that changes it", () => {
    /**
     * The screen that takes the money showed the address, the delivery date
     * and the payment method with no way to correct any of them — the only
     * route back was the browser's own button.
     */
    expect(page).toContain('<ReviewBlock title="Delivery to" onChange={() => goToStep(1)}>');
    expect(page).toContain('<ReviewBlock title="Delivery slot" onChange={() => goToStep(2)}>');
    expect(page).toContain('<ReviewBlock title="Sent by" onChange={() => goToStep(2)}>');
  });

  it("names what each link changes", () => {
    // Three links all reading "Change" on one screen say nothing about which.
    expect(page).toContain("Change {title.toLowerCase()}");
  });
});
