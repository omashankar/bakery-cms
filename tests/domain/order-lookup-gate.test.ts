/**
 * `verifyOrderLookup` guards GET /api/orders/by-number, which returns a
 * customer's name, phone, street address and every line item. The order number
 * itself is not a secret — BK-<date>-<4 digits> is 9,000 values for a given day
 * — so this predicate is the whole gate.
 */
import { describe, expect, it } from "vitest";

import { verifyOrderLookup } from "@/features/orders/lib/order-tracking";
import type { PlacedOrder } from "@/features/orders/lib/orders";

const order = {
  address: { email: "Asha@Example.com", phone: "+91 98765 43210" },
} as PlacedOrder;

describe("verifyOrderLookup", () => {
  it("accepts the order's own email, case-insensitively", () => {
    expect(verifyOrderLookup(order, { email: "asha@example.com" })).toBe(true);
    expect(verifyOrderLookup(order, { email: "  ASHA@EXAMPLE.COM  " })).toBe(true);
  });

  it("accepts the full phone in any formatting", () => {
    expect(verifyOrderLookup(order, { phone: "9876543210" })).toBe(true);
    expect(verifyOrderLookup(order, { phone: "+91 98765-43210" })).toBe(true);
  });

  it("rejects a short phone suffix", () => {
    // The old rule matched ANY suffix, so "0" opened roughly one order in ten
    // and a handful of requests walked the gate.
    for (const guess of ["0", "10", "210", "43210", "543210", "6543210"]) {
      expect(verifyOrderLookup(order, { phone: guess }), `phone=${guess}`).toBe(false);
    }
  });

  it("rejects a wrong full-length phone", () => {
    expect(verifyOrderLookup(order, { phone: "9876543211" })).toBe(false);
  });

  it("rejects a wrong email and an empty lookup", () => {
    expect(verifyOrderLookup(order, { email: "someone@else.com" })).toBe(false);
    expect(verifyOrderLookup(order, {})).toBe(false);
    expect(verifyOrderLookup(order, { email: "", phone: "" })).toBe(false);
  });

  it("rejects everything when the order itself has no contact details", () => {
    const anonymous = { address: { email: "", phone: "" } } as PlacedOrder;

    expect(verifyOrderLookup(anonymous, { email: "" })).toBe(false);
    expect(verifyOrderLookup(anonymous, { phone: "" })).toBe(false);
    expect(verifyOrderLookup(anonymous, { phone: "9876543210" })).toBe(false);
  });
});
