/**
 * The customer has been charged and the bakery does not know.
 *
 * That state used to live in React state and nowhere else, so a reload erased
 * it — while the cart and the checkout draft, both in storage, survived. The
 * page came back looking like an ordinary checkout and offered to take the
 * money again, and nothing on the server would have stopped it: placement
 * de-duplicates on the order id and on the captured payment reference, and a
 * second attempt shares neither.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearUnconfirmedOrder,
  readUnconfirmedOrder,
  saveUnconfirmedOrder,
} from "@/features/orders/lib/unconfirmed-order";
import type { PlacedOrder } from "@/features/orders/lib/orders";

const order = {
  id: "ord-1",
  orderNumber: "BK-20260811-0001",
  items: [],
  totals: { subtotal: 1200, discount: 0, deliveryFee: 0, tax: 0, total: 1200 },
  address: { fullName: "Asha Menon", email: "asha@example.com" },
  paymentMethod: "razorpay",
  paymentStatus: "paid",
  placedAt: new Date().toISOString(),
  status: "confirmed",
  statusHistory: [],
} as unknown as PlacedOrder;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a payment the bakery never acknowledged", () => {
  it("is still there after the page is reloaded", () => {
    saveUnconfirmedOrder({
      order,
      paymentStatus: "paid",
      paymentReference: "pay_test_1",
      draftId: "draft_abc",
    });

    // A reload is exactly this: the module is asked again, with only storage
    // between the two reads.
    const held = readUnconfirmedOrder();

    expect(held?.order.orderNumber).toBe("BK-20260811-0001");
    expect(held?.paymentReference).toBe("pay_test_1");
    // Without the draft id the retry cannot succeed — the shop refuses a card
    // payment that has no priced cart behind it.
    expect(held?.draftId).toBe("draft_abc");
  });

  it("does not hold a cash order hostage", () => {
    // Nobody has paid. The cart is still full and placing it again is the right
    // thing to do, so blocking every later visit behind an overlay would be the
    // worse bug.
    saveUnconfirmedOrder({ order, paymentStatus: "cod" });

    expect(readUnconfirmedOrder()).toBeNull();
  });

  it("holds a cash-on-delivery order that somehow carries a captured payment", () => {
    saveUnconfirmedOrder({ order, paymentStatus: "cod", paymentReference: "pay_test_2" });

    expect(readUnconfirmedOrder()?.paymentReference).toBe("pay_test_2");
  });

  it("gives up after a day rather than locking the customer out of the shop", () => {
    vi.useFakeTimers();
    saveUnconfirmedOrder({ order, paymentStatus: "paid", paymentReference: "pay_test_1" });

    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(readUnconfirmedOrder(), "given up on too early").not.toBeNull();

    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(readUnconfirmedOrder()).toBeNull();
    // And it is not left behind to be re-read on every visit.
    expect(localStorage.getItem("bakery-cms-unconfirmed-order")).toBeNull();
  });

  it("ignores a record it cannot show, instead of blocking checkout with it", () => {
    // The overlay names the order. A held record with no order number would
    // block the page while telling the customer nothing they could act on.
    localStorage.setItem("bakery-cms-unconfirmed-order", JSON.stringify({ paymentStatus: "paid" }));

    expect(readUnconfirmedOrder()).toBeNull();
    expect(localStorage.getItem("bakery-cms-unconfirmed-order")).toBeNull();
  });

  it("survives a corrupt record without taking the checkout page down", () => {
    localStorage.setItem("bakery-cms-unconfirmed-order", "{not json");

    expect(readUnconfirmedOrder()).toBeNull();
  });

  it("is let go once the order is confirmed", () => {
    saveUnconfirmedOrder({ order, paymentStatus: "paid", paymentReference: "pay_test_1" });
    clearUnconfirmedOrder();

    expect(readUnconfirmedOrder()).toBeNull();
  });
});
