import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { cartLineChoices } from "@/features/cart/lib/cart";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import { SAMPLE_INVOICE_ORDER } from "@/apps/admin/commerce/lib/sample-invoice-order";
import { defaultInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";
import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * The customer paid for the options. They were never told so.
 *
 * `priceLine` charges every enabled variant group and now stamps
 * `variantSummary` on the line from the same list it priced from — so an order
 * for a 256 GB charger genuinely costs ₹5,000 more and genuinely records
 * "Storage: 256 GB". But not one customer-facing surface rendered that field.
 * Six screens each built their own "what was chosen" string and each picked a
 * different subset of weight / shape / flavour; the account order list printed
 * nothing but "2 × name". The invoice — the only paper the shop prints, and the
 * one document the customer keeps — listed a number with nothing explaining it.
 *
 * These tests exist because nothing else would notice a SEVENTH surface being
 * added with a seventh subset. `cartLineChoices` is the single list; the render
 * test proves it actually reaches the page, which reading the source cannot.
 */

describe("one list of what the customer chose", () => {
  it("carries the shop's own option groups, not just the bakery fields", () => {
    expect(
      cartLineChoices({
        weight: undefined,
        flavour: undefined,
        shape: undefined,
        variantSummary: ["Storage: 256 GB", "Colour: White"],
      }),
    ).toEqual(["Storage: 256 GB", "Colour: White"]);
  });

  it("keeps the bakery fields, in a stable order, alongside the options", () => {
    expect(
      cartLineChoices({
        weight: "1 kg",
        flavour: "Chocolate",
        shape: "Heart",
        variantSummary: ["Egg preference: Eggless"],
      }),
    ).toEqual(["1 kg", "Chocolate", "Heart", "Egg preference: Eggless"]);
  });

  it("says nothing about a product that was sold with no choices at all", () => {
    // A charger. The surfaces render no line rather than an empty separator.
    expect(cartLineChoices({})).toEqual([]);
  });

  it("drops blanks rather than printing a stray separator", () => {
    // `weight: ""` reaches these lines from a module-gated add-to-cart path.
    expect(cartLineChoices({ weight: "", flavour: "   ", shape: "Round" })).toEqual(["Round"]);
  });
});

/** Render into a real DOM — the assertion is that the text reaches the page. */
function renderInvoice(order: PlacedOrder): { html: string; unmount: () => void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(InvoiceDocument, {
        order,
        settings: defaultInvoiceSettings,
        variant: "screen",
      } as never),
    );
  });

  return {
    html: container.innerHTML,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("the invoice states what was bought", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("prints the option the customer chose and was charged for", () => {
    const order = {
      ...SAMPLE_INVOICE_ORDER,
      items: [
        {
          id: "line-1",
          productSlug: "type-c-charger",
          name: "65W Type-C Charger",
          image: "",
          price: 6499,
          quantity: 1,
          variantSummary: ["Storage: 256 GB", "Colour: White"],
        },
      ],
    } as unknown as PlacedOrder;

    const { html, unmount } = renderInvoice(order);
    try {
      // Without this the invoice read "65W Type-C Charger … 6,499" and the
      // ₹5,000 difference was unexplained on the shop's own paperwork.
      expect(html).toContain("Storage: 256 GB");
      expect(html).toContain("Colour: White");
    } finally {
      unmount();
    }
  });

  it("still prints a cake's size, flavour and shape", () => {
    const { html, unmount } = renderInvoice(SAMPLE_INVOICE_ORDER as unknown as PlacedOrder);
    try {
      expect(html).toContain("1 kg");
      expect(html).toContain("Chocolate");
      expect(html).toContain("Round");
    } finally {
      unmount();
    }
  });
});
