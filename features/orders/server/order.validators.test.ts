import { describe, expect, it } from "vitest";

import { placeOrderSchema, statusSchema, refundSchema } from "./order.validators";

const validOrder = {
  items: [{ productSlug: "choc-cake", name: "Choc Cake", price: 999, quantity: 2 }],
  totals: { subtotal: 1998, total: 2097, itemCount: 2 },
  address: {
    fullName: "Asha",
    email: "asha@example.com",
    phone: "9999999999",
    addressLine1: "1 Baker St",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
  },
  paymentMethod: "cod",
};

describe("placeOrderSchema", () => {
  it("accepts a valid order", () => {
    expect(placeOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects an empty cart", () => {
    expect(placeOrderSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
  });

  it("rejects an item without a product reference", () => {
    const bad = { ...validOrder, items: [{ name: "x", price: 1, quantity: 1 }] };
    expect(placeOrderSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid address email", () => {
    const bad = { ...validOrder, address: { ...validOrder.address, email: "nope" } };
    expect(placeOrderSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown payment method", () => {
    expect(placeOrderSchema.safeParse({ ...validOrder, paymentMethod: "bitcoin" }).success).toBe(false);
  });

  it("accepts a client-provided id — it is the retry key", () => {
    // The retry path re-sends the id byte for byte so a dropped response cannot
    // become a second order and a second stock decrement for one payment.
    const parsed = placeOrderSchema.parse({ ...validOrder, id: "order-1" });
    expect(parsed.id).toBe("order-1");
  });

  it("drops every piece of lifecycle state the caller tries to choose", () => {
    // This endpoint is anonymous, and all of these used to be stored verbatim —
    // so one POST could file an order that was already `delivered` or already
    // `refunded`, backdated, with a fabricated history. The payment ledger is
    // derived from orders, so those forgeries landed in the Transaction and
    // Refund centres as real money.
    const parsed = placeOrderSchema.parse({
      ...validOrder,
      orderNumber: "BK-20260101-1234",
      placedAt: "2024-01-01T00:00:00.000Z",
      status: "delivered",
      statusHistory: [{ status: "delivered", at: "2024-01-01T00:00:00.000Z" }],
      estimatedDelivery: "2024-01-02T00:00:00.000Z",
      paymentStatus: "paid",
    }) as Record<string, unknown>;

    for (const field of [
      "orderNumber",
      "placedAt",
      "status",
      "statusHistory",
      "estimatedDelivery",
      "paymentStatus",
    ]) {
      expect(parsed[field], `${field} must not survive parsing`).toBeUndefined();
    }
  });
});

describe("status + refund schemas", () => {
  it("validates order status", () => {
    expect(statusSchema.safeParse({ status: "preparing" }).success).toBe(true);
    expect(statusSchema.safeParse({ status: "flying" }).success).toBe(false);
  });

  it("rejects a negative refund amount", () => {
    expect(refundSchema.safeParse({ amount: -10 }).success).toBe(false);
    expect(refundSchema.safeParse({ amount: 500 }).success).toBe(true);
  });
});
