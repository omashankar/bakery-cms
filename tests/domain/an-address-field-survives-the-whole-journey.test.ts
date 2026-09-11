import { describe, expect, it } from "vitest";

import { quoteSchema } from "@/features/checkout/server/checkout.validators";
import { placeOrderSchema } from "@/features/orders/server/order.validators";
import {
  EMPTY_CHECKOUT_ADDRESS,
  type CheckoutAddress,
} from "@/features/orders/lib/checkout-draft";
import { addressLines, contactNumbers, formatAddress } from "@/features/orders/lib/address-format";

/**
 * FOUR ADDRESS FIELDS, AND THE ONE PLACE THEY COULD HAVE DIED IN SILENCE.
 *
 * Landmark, country, alternate phone and Home/Office/Other are all optional, so
 * nothing in this suite breaks if any layer forgets them. That is precisely why
 * this file exists: the whole suite passed with them half-wired, and manual
 * testing passes too, because the happy path never takes the branch that loses
 * them.
 *
 * The branch that loses them is the quote. `quoteSchema.address` is a bare
 * `z.object({…})` — Zod's default is strip, and there is no `.passthrough()`
 * anywhere in that file — so a field the form collects crosses the wire, is
 * deleted during validation, and the stripped copy is what is written to the
 * draft row. HTTP 200. Nothing logs.
 *
 * It costs exactly one customer: the one who pays online and closes the tab
 * before the confirmation comes back. Their order is rebuilt by the Razorpay
 * webhook from that draft, without the browser, so `placeOrderSchema` never
 * runs and nothing can restore what the quote deleted. The customer beside them
 * who waited two seconds keeps the landmark. Same shop, same form, two
 * different records — and no way to tell from the outside which you got.
 *
 * Placement is the opposite shape: `addressSchema` DOES pass through, so the
 * risk there is an unbounded string reaching Mongo and being interpolated into
 * a courier's WhatsApp message. Both directions are pinned below.
 */

const NEW_FIELDS = ["landmark", "country", "altPhone", "addressLabel"] as const;

const ADDRESS: CheckoutAddress = {
  fullName: "Om Suman",
  email: "om@example.com",
  phone: "7627014106",
  addressLine1: "Royal Sun City, Borkheda",
  addressLine2: "Flat 4B",
  landmark: "opposite the water tank",
  city: "Kota",
  state: "Rajasthan",
  pincode: "324001",
  country: "India",
  altPhone: "9000000001",
  addressLabel: "Office",
};

describe("the quote keeps what the form collected", () => {
  it("does not strip any of the four on its way to the draft", () => {
    /**
     * The single assertion standing between this work and a shop whose
     * webhook-rescued orders quietly lose the line the rider needed.
     */
    const parsed = quoteSchema.parse({
      items: [{ productSlug: "cotton-tee", quantity: 1 }],
      address: ADDRESS,
    });

    for (const field of NEW_FIELDS) {
      expect(parsed.address?.[field], field).toBe(ADDRESS[field]);
    }
  });

  it("and still refuses an address missing what a parcel cannot go without", () => {
    // The new fields being optional must not have loosened the required ones.
    const { city: _city, ...noCity } = ADDRESS;

    expect(() =>
      quoteSchema.parse({ items: [{ productSlug: "cotton-tee", quantity: 1 }], address: noCity }),
    ).toThrow();
  });
});

describe("placement keeps them too, and bounds them", () => {
  const order = {
    items: [{ productSlug: "cotton-tee", name: "Cotton Tee", price: 800, quantity: 1 }],
    totals: { subtotal: 800, total: 800, itemCount: 1 },
    address: ADDRESS,
    paymentMethod: "cod" as const,
  };

  it("carries all four onto the order", () => {
    const parsed = placeOrderSchema.parse(order);

    for (const field of NEW_FIELDS) {
      expect(parsed.address[field as keyof typeof parsed.address], field).toBe(ADDRESS[field]);
    }
  });

  it("refuses a landmark long enough to be a payload", () => {
    /**
     * `addressSchema` passes unknown keys through, so anything NOT named there
     * reaches Mongo unchecked — and these strings are interpolated into the
     * courier's WhatsApp message. Naming them is what puts a length on them.
     */
    expect(() =>
      placeOrderSchema.parse({ ...order, address: { ...ADDRESS, landmark: "x".repeat(500) } }),
    ).toThrow();
  });

  it("refuses a label that is not one of the three offered", () => {
    expect(() =>
      placeOrderSchema.parse({ ...order, address: { ...ADDRESS, addressLabel: "Warehouse" } }),
    ).toThrow();
  });
});

describe("the empty address has every key", () => {
  it("so an older stored draft cannot hand React an undefined", () => {
    /**
     * `getCheckoutDraft` merges a stored address over this one. A key missing
     * here comes back `undefined` from a draft written before the field
     * existed, and React flips that input from controlled to uncontrolled —
     * which the compiler cannot catch, because every one of them is optional.
     */
    for (const field of NEW_FIELDS) {
      if (field === "addressLabel") continue; // a union, deliberately unset
      expect(EMPTY_CHECKOUT_ADDRESS[field], field).toBe("");
    }
  });
});

describe("one way to write an address down", () => {
  it("names the landmark rather than listing it like a street line", () => {
    // On its own, "opposite the water tank" sits among the street lines as
    // though it were one.
    expect(addressLines(ADDRESS)).toContain("Near opposite the water tank");
  });

  it("keeps the state, which two outbound messages were dropping", () => {
    /**
     * The shop's new-order alert and the courier's "out for delivery" message
     * each had their own copy of this join, and both ended
     * `${city} ${pincode}` — no state at all, on the two messages that leave
     * the building.
     */
    expect(formatAddress(ADDRESS)).toContain("Rajasthan");
    expect(formatAddress(ADDRESS)).toContain("opposite the water tank");
  });

  it("prints no blank lines for the fields nobody filled in", () => {
    const sparse: CheckoutAddress = {
      ...EMPTY_CHECKOUT_ADDRESS,
      fullName: "Om",
      addressLine1: "1 Probe Lane",
      city: "Kota",
      state: "Rajasthan",
      pincode: "324001",
    };

    expect(addressLines(sparse)).toEqual(["1 Probe Lane", "Kota, Rajasthan, 324001"]);
  });

  it("shows a second number only when there is a different one", () => {
    expect(contactNumbers(ADDRESS)).toBe("7627014106 / 9000000001");
    expect(contactNumbers({ phone: "7627014106" })).toBe("7627014106");
    // A customer who typed the same number twice is not two numbers.
    expect(contactNumbers({ phone: "7627014106", altPhone: "7627014106" })).toBe("7627014106");
  });
});
