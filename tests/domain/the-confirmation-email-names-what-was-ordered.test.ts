import { describe, expect, it } from "vitest";

import { seedEmailTemplates } from "@/features/communications/lib/email-template-seed";
import {
  availableVariablesFor,
  offContractVariables,
  TEMPLATE_VARIABLE_CONTRACT,
} from "@/features/communications/lib/template-contract";
import { renderTemplate } from "@/lib/template-render";
import { formatOrderItemsForEmail } from "@/features/orders/server/order.service";
import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * The one record a customer receives without logging in named no product.
 *
 * `order_confirmation` supplied six variables — a name, a number, a total, a
 * payment method, a delivery date and a link — and not one of them said WHAT
 * had been bought. A customer who ordered a 256 GB charger and a 1 kg eggless
 * cake got an email quoting a single total, and the only way to see the items
 * was to follow the tracking link back into the site.
 *
 * The shop's own copy already had this: `admin_new_order` declares
 * `order_items` and its body prints them. The customer's copy did not.
 *
 * Both emails now format their lines through one function, so the baker and
 * the customer cannot be told different things about the same order.
 */

const ORDER = {
  orderNumber: "BK-1",
  items: [
    {
      id: "l1",
      productSlug: "type-c-charger",
      name: "65W Type-C Charger",
      image: "",
      price: 6499,
      quantity: 1,
      variantSummary: ["Storage: 256 GB", "Colour: White"],
    },
    {
      id: "l2",
      productSlug: "black-forest",
      name: "Black Forest",
      image: "",
      price: 1079,
      quantity: 2,
      weight: "1 kg",
      variantSummary: ["Egg preference: Eggless"],
      message: "Happy Birthday Aarav",
      photoUrl: "https://cdn.test/upload/photo.jpg",
    },
  ],
} as unknown as PlacedOrder;

describe("the item list both emails are built from", () => {
  it("names the product, the quantity and everything the customer chose", () => {
    const text = formatOrderItemsForEmail(ORDER.items);

    expect(text).toContain("1 x 65W Type-C Charger");
    expect(text).toContain("Storage: 256 GB · Colour: White");
    expect(text).toContain("2 x Black Forest");
    expect(text).toContain("1 kg · Egg preference: Eggless");
    expect(text).toContain("Happy Birthday Aarav");
  });

  it("gives the baker the photo link and does not put it in the customer's copy", () => {
    // The baker cannot print a photo they cannot open. The customer uploaded it
    // and does not need the storage URL read back to them.
    expect(formatOrderItemsForEmail(ORDER.items, { includePhotoLink: true })).toContain(
      "https://cdn.test/upload/photo.jpg",
    );
    expect(formatOrderItemsForEmail(ORDER.items)).not.toContain("https://cdn.test/upload/photo.jpg");
  });

  it("says nothing extra about a line that carried no choices", () => {
    const text = formatOrderItemsForEmail([
      { id: "l", productSlug: "p", name: "Plain", image: "", price: 100, quantity: 1 },
    ] as unknown as PlacedOrder["items"]);

    // One line, no dangling separator under it.
    expect(text.trim()).toBe("1 x Plain");
  });
});

describe("the confirmation template can carry the items", () => {
  it("declares order_items on the contract, so every shop's editor offers the chip", () => {
    // `availableVariablesFor` reads the CONTRACT, not the stored row's own
    // `variables` list — which is why this reaches shops whose template was
    // seeded long ago and is never rewritten.
    expect(TEMPLATE_VARIABLE_CONTRACT.order_confirmation).toContain("order_items");
    expect(availableVariablesFor("order_confirmation", [])).toContain("order_items");

    // And it is not off-contract, so the admin editor will not flag a body
    // that uses it.
    expect(offContractVariables("order_confirmation", ["order_items"])).toEqual([]);
  });

  it("ships in the seeded body, so a new shop needs no edit", () => {
    const seeded = seedEmailTemplates().find((t) => t.slug === "order_confirmation");

    expect(seeded?.body).toContain("{{order_items}}");
    expect(seeded?.variables).toContain("order_items");
  });

  it("renders with what order.service supplies, leaving nothing unresolved", () => {
    const seeded = seedEmailTemplates().find((t) => t.slug === "order_confirmation");
    const rendered = renderTemplate(seeded?.body ?? "", {
      customer_name: "Asha",
      store_name: "Sweet Crumbs Bakery",
      order_number: "BK-1",
      order_total: "₹8,657.00",
      payment_method: "Paid online",
      delivery_date: "2026-09-03",
      invoice_url: "https://example.test/track",
      order_items: formatOrderItemsForEmail(ORDER.items),
    });

    expect(rendered).toContain("65W Type-C Charger");
    expect(rendered).toContain("Storage: 256 GB");
    expect(rendered).not.toContain("{{");
  });
});
