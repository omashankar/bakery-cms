/**
 * A customer is not stored anywhere — they exist only as the sum of their
 * orders. That makes an order cap uniquely destructive here: it does not shorten
 * the customer list, it deletes older customers and understates the spend of
 * everyone left. So this derivation moved to the domain layer and now runs
 * server-side over every order; these pin what it computes.
 */
import { describe, expect, it } from "vitest";

import {
  buildCustomerProfiles,
  buildCustomerRecords,
  customerKey,
  deriveCustomerSegment,
  type CustomerMeta,
} from "@/features/customers/lib/customer-profiles";
import type { PlacedOrder } from "@/features/orders/lib/orders";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const DAY = 86_400_000;

function order(overrides: Partial<PlacedOrder> = {}): PlacedOrder {
  const address = {
    fullName: "Asha",
    email: "asha@example.com",
    phone: "9999999999",
    addressLine1: "1 Baker St",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    ...(overrides.address ?? {}),
  };

  return {
    id: "o1",
    orderNumber: "BK-1",
    items: [{ id: "i1", productSlug: "choc", name: "Choc", price: 100, quantity: 2 }],
    totals: {
      subtotal: 200,
      delivery: 0,
      tax: 0,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 0,
      taxableAmount: 200,
      total: 500,
      itemCount: 2,
    },
    paymentMethod: "upi",
    paymentStatus: "paid",
    placedAt: new Date(NOW).toISOString(),
    status: "delivered",
    statusHistory: [],
    ...overrides,
    address,
  } as PlacedOrder;
}

const noMeta = () => undefined;

describe("customer grouping", () => {
  it("groups case-insensitively and ignoring surrounding whitespace", () => {
    // The same person typing their address differently must not become two
    // customers — and the key has to match how the meta store keys its rows.
    const records = buildCustomerRecords([
      order({ id: "a", address: { email: "asha@example.com" } } as Partial<PlacedOrder>),
      order({ id: "b", address: { email: "  ASHA@Example.com " } } as Partial<PlacedOrder>),
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].orderCount).toBe(2);
    expect(records[0].totalSpent).toBe(1000);
    expect(records[0].id).toBe(customerKey("  ASHA@Example.com "));
  });

  it("skips orders with no email rather than inventing a blank customer", () => {
    expect(
      buildCustomerRecords([order({ address: { email: "" } } as Partial<PlacedOrder>)])
    ).toHaveLength(0);
  });

  it("keeps the newest order as lastOrderAt regardless of input order", () => {
    const records = buildCustomerRecords([
      order({ id: "old", orderNumber: "BK-OLD", placedAt: new Date(NOW - 10 * DAY).toISOString() }),
      order({ id: "new", orderNumber: "BK-NEW", placedAt: new Date(NOW).toISOString() }),
      order({ id: "mid", orderNumber: "BK-MID", placedAt: new Date(NOW - 5 * DAY).toISOString() }),
    ]);

    expect(records[0].lastOrderNumber).toBe("BK-NEW");
  });
});

describe("segment derivation", () => {
  const base = { id: "a", email: "a@x.com", name: "A", phone: "1", lastOrderNumber: "BK-1" };

  it("calls five orders or ₹5000 spent a VIP", () => {
    const byCount = { ...base, orderCount: 5, totalSpent: 100, lastOrderAt: new Date(NOW).toISOString() };
    const bySpend = { ...base, orderCount: 1, totalSpent: 5000, lastOrderAt: new Date(NOW).toISOString() };

    expect(deriveCustomerSegment(byCount, NOW)).toBe("vip");
    expect(deriveCustomerSegment(bySpend, NOW)).toBe("vip");
  });

  it("separates at-risk from inactive by whether they ever came back", () => {
    const stale = new Date(NOW - 120 * DAY).toISOString();

    expect(
      deriveCustomerSegment({ ...base, orderCount: 2, totalSpent: 100, lastOrderAt: stale }, NOW)
    ).toBe("at_risk");
    expect(
      deriveCustomerSegment({ ...base, orderCount: 1, totalSpent: 100, lastOrderAt: stale }, NOW)
    ).toBe("inactive");
  });

  it("takes the clock as an argument so the server does not decide it", () => {
    const customer = { ...base, orderCount: 1, totalSpent: 100, lastOrderAt: new Date(NOW).toISOString() };

    expect(deriveCustomerSegment(customer, NOW)).toBe("new");
    // Same customer, judged 200 days later.
    expect(deriveCustomerSegment(customer, NOW + 200 * DAY)).toBe("inactive");
  });
});

describe("buildCustomerProfiles", () => {
  const orders = [
    order({ id: "a", placedAt: new Date(NOW - 30 * DAY).toISOString(), orderNumber: "BK-FIRST" }),
    order({ id: "b", placedAt: new Date(NOW).toISOString(), orderNumber: "BK-LAST" }),
    order({ id: "c", status: "cancelled", placedAt: new Date(NOW - 5 * DAY).toISOString() }),
  ];

  it("finds the customer's first order, not just their most recent", () => {
    const [profile] = buildCustomerProfiles(orders, noMeta, NOW);

    expect(profile.firstOrderNumber).toBe("BK-FIRST");
    expect(profile.lastOrderNumber).toBe("BK-LAST");
  });

  it("averages over countable orders only, while spend still includes them", () => {
    const [profile] = buildCustomerProfiles(orders, noMeta, NOW);

    // Three orders of ₹500; the cancelled one is excluded from the divisor.
    expect(profile.totalSpent).toBe(1500);
    expect(profile.averageOrderValue).toBe(750);
  });

  it("counts orders by status", () => {
    const [profile] = buildCustomerProfiles(orders, noMeta, NOW);

    expect(profile.deliveredOrders).toBe(2);
    expect(profile.cancelledOrders).toBe(1);
    expect(profile.activeOrders).toBe(0);
  });

  it("excludes cancelled orders from favourite products", () => {
    const [profile] = buildCustomerProfiles(orders, noMeta, NOW);

    // Two countable orders of 2 units each.
    expect(profile.favoriteProducts[0]).toMatchObject({ slug: "choc", quantity: 4 });
  });

  it("does not leak one customer's orders into another's profile", () => {
    const profiles = buildCustomerProfiles(
      [
        order({ id: "a1", address: { email: "a@x.com" } } as Partial<PlacedOrder>),
        order({ id: "b1", address: { email: "b@x.com" } } as Partial<PlacedOrder>),
        order({ id: "b2", address: { email: "b@x.com" } } as Partial<PlacedOrder>),
      ],
      noMeta,
      NOW
    );

    const byEmail = Object.fromEntries(profiles.map((p) => [p.id, p]));
    expect(byEmail["a@x.com"].orderCount).toBe(1);
    expect(byEmail["b@x.com"].orderCount).toBe(2);
    expect(byEmail["b@x.com"].totalSpent).toBe(1000);
  });

  it("joins admin metadata on the normalised key", () => {
    const meta: CustomerMeta = {
      email: "asha@example.com",
      tags: ["vip"],
      notes: "Prefers evening delivery",
      marketingOptIn: false,
      updatedAt: new Date(NOW).toISOString(),
    };

    const [profile] = buildCustomerProfiles(
      [order({ address: { email: " Asha@Example.com " } } as Partial<PlacedOrder>)],
      (key) => (key === "asha@example.com" ? meta : undefined),
      NOW
    );

    expect(profile.meta.tags).toEqual(["vip"]);
  });

  it("falls back to blank metadata rather than leaving it undefined", () => {
    const [profile] = buildCustomerProfiles([order()], noMeta, NOW);

    expect(profile.meta.tags).toEqual([]);
    expect(profile.meta.marketingOptIn).toBe(true);
  });
});
