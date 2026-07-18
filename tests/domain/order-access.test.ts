/**
 * Order pages used to render from the URL alone — anyone with an order number
 * saw the customer's name, phone, email and home address. These pin the gate.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { canViewOrder, grantOrderAccess, ownsOrder } from "@/features/orders/lib/order-access";
import type { PlacedOrder } from "@/features/orders/lib/orders";

function order(email = "asha@example.com", orderNumber = "BK-20260101-1234"): PlacedOrder {
  return {
    orderNumber,
    address: { email, fullName: "Asha", phone: "+919999999999" },
  } as unknown as PlacedOrder;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("ownsOrder", () => {
  it("matches the signed-in customer", () => {
    expect(ownsOrder(order(), "asha@example.com")).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(ownsOrder(order(), "  ASHA@Example.com ")).toBe(true);
  });

  it("rejects a different customer", () => {
    expect(ownsOrder(order(), "someone-else@example.com")).toBe(false);
  });

  it("rejects a signed-out visitor", () => {
    expect(ownsOrder(order(), null)).toBe(false);
    expect(ownsOrder(order(), undefined)).toBe(false);
    expect(ownsOrder(order(), "")).toBe(false);
  });
});

describe("canViewOrder", () => {
  it("blocks a stranger holding only the order number", () => {
    expect(canViewOrder(order(), null)).toBe(false);
    expect(canViewOrder(order(), "stranger@example.com")).toBe(false);
  });

  it("allows the customer who owns it", () => {
    expect(canViewOrder(order(), "asha@example.com")).toBe(true);
  });

  it("allows a visitor who proved ownership through the track-order form", () => {
    const target = order();
    expect(canViewOrder(target, null)).toBe(false);

    grantOrderAccess(target.orderNumber);

    expect(canViewOrder(target, null)).toBe(true);
  });

  it("does not let one verified order unlock another", () => {
    grantOrderAccess("BK-20260101-1234");

    expect(canViewOrder(order("asha@example.com", "BK-20260101-9999"), null)).toBe(false);
  });

  it("granting twice is harmless", () => {
    grantOrderAccess("BK-20260101-1234");
    grantOrderAccess("BK-20260101-1234");

    expect(canViewOrder(order(), null)).toBe(true);
  });

  it("survives corrupt grant storage rather than throwing", () => {
    sessionStorage.setItem("bakery-cms-verified-orders", "{ not json");

    expect(() => canViewOrder(order(), null)).not.toThrow();
    expect(canViewOrder(order(), null)).toBe(false);
  });
});
