import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrderSummaryPanel } from "@/apps/website/checkout/components/order-summary-panel";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import { SAMPLE_INVOICE_ORDER } from "@/apps/admin/commerce/lib/sample-invoice-order";
import { defaultInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";

/**
 * A CUSTOMER NEVER SEES A ZONE'S NAME.
 *
 * A zone's name is the owner's own word — "sangod", "₹40 areas" — and the
 * owner's rule is that customers never see it. The product page and the map
 * kept it; the order summary (checkout, cart, the customer's order page) and
 * the customer's invoice still printed "Delivery zone: sangod" (found in the
 * zone review, 2026-10-28). Rendered here, not read as text.
 */

const OWNERS_WORD = "Sangod-owner-zone";

const text = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("what the customer is shown", () => {
  it("the order summary says the days, not the zone", () => {
    const html = renderToStaticMarkup(
      createElement(OrderSummaryPanel, {
        items: [],
        totals: { subtotal: 500, total: 599, delivery: 99, itemCount: 1, deliveryZoneName: OWNERS_WORD, estimatedDeliveryDays: 2 } as never,
        showItems: false,
      }),
    );
    expect(text(html)).not.toContain(OWNERS_WORD);
    expect(text(html)).toContain("Estimated delivery: 2 day(s)");
  });

  it("the customer's invoice carries no zone name", () => {
    const order = { ...SAMPLE_INVOICE_ORDER, totals: { ...SAMPLE_INVOICE_ORDER.totals, deliveryZoneName: OWNERS_WORD } };
    const html = renderToStaticMarkup(createElement(InvoiceDocument, { order, settings: defaultInvoiceSettings }));
    expect(text(html)).not.toContain(OWNERS_WORD);
  });
});
