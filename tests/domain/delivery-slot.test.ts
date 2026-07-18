/**
 * The delivery slot chosen at checkout.
 *
 * An order is delivered once, so the window agreed at checkout is the promise
 * to the customer — it must survive into the order and win over the per-item
 * dates that can be picked on a product page.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_CHECKOUT_DRAFT,
  EMPTY_DELIVERY_SLOT,
  getCheckoutDraft,
  hasDeliverySlot,
  saveCheckoutDraft,
} from "@/features/orders/lib/checkout-draft";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { getOrders, placeOrder } from "@/features/orders/lib/orders";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { CartLineItem } from "@/features/cart/lib/cart";

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    id: "line-1",
    productSlug: "black-forest",
    name: "Black Forest",
    image: "",
    price: 500,
    quantity: 1,
    ...overrides,
  };
}

const address = {
  fullName: "Asha",
  email: "asha@example.com",
  phone: "+919999999999",
  addressLine1: "1 Baker Street",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
};

function order(overrides: Parameters<typeof placeOrder>[0] extends infer T ? Partial<T> : never) {
  const items = [line()];
  return placeOrder({
    items,
    totals: calculateCartTotals({ items, commerceOverride: defaultCommerceSettings }),
    address,
    paymentMethod: "cod",
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("hasDeliverySlot", () => {
  it("needs both a date and a window", () => {
    expect(hasDeliverySlot({ date: "2026-08-01", timeSlot: "2:00 PM – 4:00 PM" })).toBe(true);
    expect(hasDeliverySlot({ date: "2026-08-01", timeSlot: "" })).toBe(false);
    expect(hasDeliverySlot({ date: "", timeSlot: "2:00 PM – 4:00 PM" })).toBe(false);
  });

  it("rejects blank and missing slots", () => {
    expect(hasDeliverySlot(EMPTY_DELIVERY_SLOT)).toBe(false);
    expect(hasDeliverySlot(undefined)).toBe(false);
    expect(hasDeliverySlot({ date: "   ", timeSlot: "   " })).toBe(false);
  });
});

describe("the draft carries the slot", () => {
  it("defaults to an empty slot rather than undefined", () => {
    expect(getCheckoutDraft().deliverySlot).toEqual(EMPTY_DELIVERY_SLOT);
  });

  it("round-trips a chosen slot through storage", () => {
    saveCheckoutDraft({
      ...DEFAULT_CHECKOUT_DRAFT,
      deliverySlot: { date: "2026-08-01", timeSlot: "4:00 PM – 6:00 PM" },
    });

    expect(getCheckoutDraft().deliverySlot).toEqual({
      date: "2026-08-01",
      timeSlot: "4:00 PM – 6:00 PM",
    });
  });

  it("backfills the slot on a draft saved before the field existed", () => {
    // Exactly what a customer mid-checkout would have in sessionStorage.
    sessionStorage.setItem(
      "bakery-cms-checkout-draft",
      JSON.stringify({ step: 2, address, paymentMethod: "cod" })
    );

    expect(getCheckoutDraft().deliverySlot).toEqual(EMPTY_DELIVERY_SLOT);
    expect(getCheckoutDraft().step).toBe(2);
  });
});

describe("the order records the agreed window", () => {
  it("stores the slot on the order", () => {
    const placed = order({
      deliverySlot: { date: "2026-08-01", timeSlot: "2:00 PM – 4:00 PM" },
    });

    expect(placed.deliverySlot).toEqual({
      date: "2026-08-01",
      timeSlot: "2:00 PM – 4:00 PM",
    });
    expect(getOrders()[0].deliverySlot?.timeSlot).toBe("2:00 PM – 4:00 PM");
  });

  it("uses the chosen date as the estimated delivery", () => {
    const placed = order({
      deliverySlot: { date: "2026-08-01", timeSlot: "2:00 PM – 4:00 PM" },
    });

    expect(placed.estimatedDelivery.startsWith("2026-08-01")).toBe(true);
  });

  it("prefers the checkout slot over a date picked on the product page", () => {
    const items = [line({ deliveryDate: "2026-09-15" })];
    const placed = placeOrder({
      items,
      totals: calculateCartTotals({ items, commerceOverride: defaultCommerceSettings }),
      address,
      paymentMethod: "cod",
      deliverySlot: { date: "2026-08-01", timeSlot: "2:00 PM – 4:00 PM" },
    });

    expect(placed.estimatedDelivery.startsWith("2026-08-01")).toBe(true);
  });

  it("still falls back to the item date when no slot was chosen", () => {
    const items = [line({ deliveryDate: "2026-09-15" })];
    const placed = placeOrder({
      items,
      totals: calculateCartTotals({ items, commerceOverride: defaultCommerceSettings }),
      address,
      paymentMethod: "cod",
    });

    expect(placed.estimatedDelivery.startsWith("2026-09-15")).toBe(true);
  });

  it("ignores an unparseable slot date rather than producing an invalid order", () => {
    const placed = order({ deliverySlot: { date: "not-a-date", timeSlot: "Morning" } });

    expect(placed.estimatedDelivery).toBeTruthy();
    expect(Number.isNaN(new Date(placed.estimatedDelivery).getTime())).toBe(false);
  });
});
