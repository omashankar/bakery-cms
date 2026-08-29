/**
 * A customer paid, and was told the payment failed.
 *
 * The message they saw was this, verbatim, in the Payment failed dialog:
 *
 *   Failed to execute 'setItem' on 'Storage': Setting the value of
 *   'bakery-cms-orders' exceeded the quota.
 *
 * `placeOrder` wrote its local copy BEFORE calling the server:
 *
 *   writeOrders([order, ...readOrders()]);
 *   return adoptStoredOrder(order, await placeOrderRequest(order, draftId));
 *
 * so a browser at its localStorage limit threw on line one and line two never
 * ran. Razorpay had already CAPTURED — `finalizeOrder("paid", …)` is only
 * reached once it has — so the shop had the money and no order, and checkout's
 * catch reported the storage error as "Payment failed". Retry hit the same wall
 * and could charge them again.
 *
 * The browser's copy is a convenience that the next hydration rebuilds from the
 * server. It must never be able to stop an order reaching the server, and this
 * is the assertion that says so.
 *
 * How the quota fills: the admin layout hydrates the WHOLE shop's order history
 * into this same key, so a shop owner signed in to the admin who then opens
 * their own storefront in the same browser is exactly the reported case.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { CartLineItem } from "@/features/cart/lib/cart";

const sent = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/features/orders/lib/orders-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/orders/lib/orders-api")>();
  return {
    ...actual,
    placeOrderRequest: async () => {
      sent.count += 1;
      return { ok: true as const };
    },
  };
});

const { placeOrder } = await import("@/features/orders/lib/orders");

const address = {
  fullName: "Asha Verma",
  email: "asha@example.com",
  phone: "+919999900000",
  addressLine1: "12 Station Road",
  city: "Kota",
  state: "Rajasthan",
  pincode: "324001",
};

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

function order(seed: number) {
  const items = [line({ price: 500 + seed })];
  return {
    items,
    totals: calculateCartTotals({ items, commerceOverride: defaultCommerceSettings }),
    address: { ...address, phone: `+91999990${String(seed).padStart(4, "0")}` },
    paymentMethod: "razorpay" as const,
    paymentStatus: "paid" as const,
    paymentReference: `pay_${seed}`,
  };
}

const realSetItem = Storage.prototype.setItem;

/** Refuse writes the way a browser at its quota does. */
function fillTheDisk() {
  Storage.prototype.setItem = function setItem(this: Storage, key: string) {
    throw new DOMException(
      `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`,
      "QuotaExceededError",
    );
  } as typeof Storage.prototype.setItem;
}

beforeEach(() => {
  sent.count = 0;
  localStorage.clear();
});

afterEach(() => {
  Storage.prototype.setItem = realSetItem;
});

describe("placing an order in a browser with no room left", () => {
  it("still reaches the server", async () => {
    fillTheDisk();

    const result = await placeOrder(order(1));

    expect(sent.count, "the order never reached the server").toBe(1);
    expect(result.order.paymentReference).toBe("pay_1");
  });

  it("does not throw, so checkout cannot report it as a failed payment", async () => {
    fillTheDisk();

    await expect(placeOrder(order(2))).resolves.toBeTruthy();
  });

  it("reaches the server when storage works too", async () => {
    // Anti-vacuity: a mock that counted nothing, or a placeOrder that had
    // stopped calling the server at all, would pass the first test.
    const result = await placeOrder(order(3));

    expect(sent.count).toBe(1);
    expect(result.order.paymentReference).toBe("pay_3");
  });

  it("proves the disk really is refusing writes", async () => {
    // Without this the quota simulation could be silently inert, and the first
    // two tests would be asserting nothing about a full browser at all.
    fillTheDisk();
    expect(() => localStorage.setItem("probe", "x")).toThrow(/exceeded the quota/);
  });
});
