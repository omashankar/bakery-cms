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

  it("accepts a client-provided id and orderNumber", () => {
    const parsed = placeOrderSchema.parse({ ...validOrder, id: "order-1", orderNumber: "BK-20260101-1234" });
    expect(parsed.id).toBe("order-1");
    expect(parsed.orderNumber).toBe("BK-20260101-1234");
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
