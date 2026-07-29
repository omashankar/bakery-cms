/**
 * These aggregations now run on the SERVER over every order, not in the browser
 * over a cached slice. Two things therefore have to hold: the maths must be
 * unchanged, and nothing may depend on the machine's own timezone — the server's
 * timezone is not the admin's.
 */
import { describe, expect, it } from "vitest";

import {
  filterOrdersInPreviousWindow,
  filterOrdersInWindow,
  getAnalyticsWindow,
  getRangeStart,
  getRevenueTrend,
  getReportsSummary,
  getTopProducts,
  type ReportDateRange,
} from "@/features/orders/lib/order-analytics";
import { isValidTimeZone } from "@/features/orders/lib/viewer-time";
import type { PlacedOrder } from "@/features/orders/lib/orders";

function order(overrides: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: "o1",
    orderNumber: "BK-1",
    items: [{ id: "i1", productSlug: "choc", name: "Choc", price: 100, quantity: 2 }],
    totals: {
      subtotal: 200,
      delivery: 50,
      tax: 10,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 0,
      taxableAmount: 200,
      total: 260,
      itemCount: 2,
    },
    address: {
      fullName: "A",
      email: "a@example.com",
      phone: "1",
      addressLine1: "x",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
    },
    paymentMethod: "upi",
    paymentStatus: "paid",
    placedAt: new Date().toISOString(),
    status: "delivered",
    statusHistory: [],
    ...overrides,
  } as PlacedOrder;
}

/** India never observes DST — a good control for the zone plumbing. */
const IST = "Asia/Kolkata";

function totalCharted(range: ReportDateRange, orders: PlacedOrder[], tz: string) {
  return getRevenueTrend(orders, range, tz).reduce((sum, point) => sum + point.revenue, 0);
}

describe("revenue trend bucketing", () => {
  it("charts an order placed right now, at UTC", () => {
    expect(totalCharted("7d", [order()], "UTC")).toBe(260);
  });

  it("charts an order placed right now for a viewer east of UTC", () => {
    // The old code seeded buckets from local midnight converted to a UTC date,
    // but keyed orders by their raw UTC date. East of UTC those differ, so most
    // of today's orders hit a key with no bucket and vanished from the chart.
    expect(totalCharted("7d", [order()], IST)).toBe(260);
  });

  it("charts today's orders across the whole day in a non-UTC zone", () => {
    // Walk today's hours: every one of them must land in some bucket.
    const now = new Date();
    for (let hour = 0; hour < 24; hour++) {
      const at = new Date(now);
      at.setUTCHours(hour, 0, 0, 0);
      if (at.getTime() > Date.now()) continue; // not placed yet

      const charted = totalCharted("7d", [order({ placedAt: at.toISOString() })], IST);
      expect(charted, `order at ${at.toISOString()} was dropped`).toBe(260);
    }
  });

  it("produces one bucket per day for 7d and 30d", () => {
    expect(getRevenueTrend([], "7d", IST)).toHaveLength(7);
    expect(getRevenueTrend([], "30d", IST)).toHaveLength(30);
  });

  it("seeds every month the window touches, not a fixed count", () => {
    // 90d reaches 89 days back, which routinely starts in a FOURTH calendar
    // month. A fixed three buckets dropped every order in the earliest one —
    // silently, while those orders still counted in the cards above the chart.
    const june30 = Date.parse("2026-06-30T12:00:00.000Z");
    const trend = getRevenueTrend([], "90d", "UTC", june30);

    // 89 days before 30 Jun is 2 Apr — Apr, May, Jun.
    expect(trend.map((p) => p.label)).toEqual(["Apr", "May", "Jun"]);

    const mar1 = Date.parse("2026-03-01T12:00:00.000Z");
    // 89 days before 1 Mar 2026 is 2 Dec 2025 — Dec, Jan, Feb, Mar. A span that
    // crosses a year carries the year, so "Dec 25" cannot be mistaken for a
    // December in the same year as the Januarys beside it.
    expect(getRevenueTrend([], "90d", "UTC", mar1).map((p) => p.label)).toEqual([
      "Dec 25",
      "Jan 26",
      "Feb 26",
      "Mar 26",
    ]);
  });

  it("does not let one malformed timestamp seed an all-time chart from 1970", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    const trend = getRevenueTrend(
      [
        order({ id: "good", placedAt: "2026-05-10T06:00:00.000Z" }),
        order({ id: "broken", placedAt: "not-a-date" }),
      ],
      "all",
      "UTC",
      now
    );

    // May, Jun, Jul — not 679 bars back to January 1970.
    expect(trend.map((p) => p.label)).toEqual(["May", "Jun", "Jul"]);
  });

  it("omits the year when the whole span sits inside one", () => {
    const june30 = Date.parse("2026-06-30T12:00:00.000Z");

    expect(getRevenueTrend([], "90d", "UTC", june30).map((p) => p.label)).toEqual([
      "Apr",
      "May",
      "Jun",
    ]);
  });

  it("charts an order in the earliest month of a 90d window", () => {
    const mar1 = Date.parse("2026-03-01T12:00:00.000Z");
    const inDecember = order({ placedAt: "2025-12-10T06:00:00.000Z" });

    const charted = getRevenueTrend([inDecember], "90d", "UTC", mar1).reduce(
      (sum, point) => sum + point.revenue,
      0
    );

    expect(charted).toBe(260);
  });

  it("keeps the 12m window a full 12 months on a month-end day", () => {
    // Subtracting 11 months from 31 March lands on a day April does not have;
    // the date used to roll forward to 1 May, silently shortening the window.
    const mar31 = Date.parse("2026-03-31T12:00:00.000Z");

    expect(getRangeStart("12m", "UTC", mar31)?.toISOString().slice(0, 10)).toBe("2025-04-30");
    expect(getRevenueTrend([], "12m", "UTC", mar31)).toHaveLength(12);
  });

  it("excludes cancelled and refunded revenue but still counts the order", () => {
    const points = getRevenueTrend([order({ status: "cancelled" })], "7d", IST);
    const revenue = points.reduce((sum, p) => sum + p.revenue, 0);
    const orders = points.reduce((sum, p) => sum + p.orders, 0);

    expect(revenue).toBe(0);
    expect(orders).toBe(1);
  });
});

describe("daylight saving", () => {
  // A numeric offset is one instant's worth of information. New York is -05:00
  // in winter and -04:00 in summer, so a single sampled offset applied across a
  // week puts every day on the far side of the change into the wrong bucket —
  // and a bucket that does not exist silently swallows those orders.
  const NY = "America/New_York";
  // 9 Mar 2025 02:00 local is when the US springs forward.
  const AFTER_SPRING_FORWARD = Date.parse("2025-03-12T16:00:00.000Z");

  it("charts every day of a window that straddles a DST change", () => {
    const trend = getRevenueTrend([], "7d", NY, AFTER_SPRING_FORWARD);

    // Seven distinct calendar days, not six-and-a-duplicate.
    expect(trend).toHaveLength(7);
    expect(new Set(trend.map((p) => p.label)).size).toBe(7);
  });

  it("charts an order placed on either side of the change", () => {
    // 7 Mar (still EST, UTC-5) and 11 Mar (now EDT, UTC-4), both 09:00 local.
    const beforeChange = order({ id: "est", placedAt: "2025-03-07T14:00:00.000Z" });
    const afterChange = order({ id: "edt", placedAt: "2025-03-11T13:00:00.000Z" });

    const charted = getRevenueTrend(
      [beforeChange, afterChange],
      "7d",
      NY,
      AFTER_SPRING_FORWARD
    ).reduce((sum, point) => sum + point.revenue, 0);

    expect(charted).toBe(520);
  });

  it("puts late-evening local orders on the local day, not the next UTC one", () => {
    // 23:30 on 11 Mar in New York is 03:30 on 12 Mar UTC.
    const lateEvening = order({ placedAt: "2025-03-12T03:30:00.000Z" });
    const trend = getRevenueTrend([lateEvening], "7d", NY, AFTER_SPRING_FORWARD);
    const charged = trend.filter((point) => point.revenue > 0);

    expect(charged).toHaveLength(1);
    expect(charged[0].label).toBe("11 Mar");
  });

  it("falls back to UTC for a zone it does not recognise", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Middle/Earth")).toBe(false);
  });
});

describe("analytics window", () => {
  // 2026-07-29T09:00:00Z — 14:30 in IST, so viewer-local and UTC days differ.
  const NOW = Date.parse("2026-07-29T09:00:00.000Z");

  it("starts the range at the VIEWER's midnight, not the machine's", () => {
    const start = getRangeStart("7d", IST, NOW);

    // "7d" is today plus the 6 days before it, so it starts at midnight on
    // 23 Jul IST — which is 18:30Z on 22 Jul. Reading the boundary off the
    // machine's own clock would give a different instant on every deployment.
    expect(start?.toISOString()).toBe("2026-07-22T18:30:00.000Z");
  });

  it("returns no start for all-time", () => {
    expect(getRangeStart("all", IST, NOW)).toBeNull();
    expect(getAnalyticsWindow("all", IST, NOW)).toEqual({ start: null, previousStart: null });
  });

  it("makes the comparison window exactly adjacent to the current one", () => {
    // Both boundaries come from ONE clock reading. Sampling twice let the
    // database load from one previousStart while the filter used an earlier
    // one, so a sliver of the comparison period was never loaded at all.
    const window = getAnalyticsWindow("30d", IST, NOW);
    const start = window.start!.getTime();
    const previousStart = window.previousStart!.getTime();

    expect(previousStart).toBeLessThan(start);
    // The comparison period spans exactly the elapsed part of the current one.
    expect(start - previousStart).toBe(NOW - start);
  });

  it("partitions orders with no gap and no overlap between the two windows", () => {
    const window = getAnalyticsWindow("7d", IST, NOW);
    const start = window.start!.getTime();
    const previousStart = window.previousStart!.getTime();

    const orders = [
      order({ id: "before", placedAt: new Date(previousStart - 1).toISOString() }),
      order({ id: "prev-edge", placedAt: new Date(previousStart).toISOString() }),
      order({ id: "prev-last", placedAt: new Date(start - 1).toISOString() }),
      order({ id: "cur-edge", placedAt: new Date(start).toISOString() }),
      order({ id: "now", placedAt: new Date(NOW).toISOString() }),
    ];

    const current = filterOrdersInWindow(orders, window).map((o) => o.id);
    const previous = filterOrdersInPreviousWindow(orders, window).map((o) => o.id);

    expect(current).toEqual(["cur-edge", "now"]);
    expect(previous).toEqual(["prev-edge", "prev-last"]);
    // "before" belongs to neither, and nothing is counted twice.
    expect(current.filter((id) => previous.includes(id))).toEqual([]);
  });

  it("treats all-time as every order, with no comparison period", () => {
    const window = getAnalyticsWindow("all", IST, NOW);
    const orders = [order({ id: "ancient", placedAt: "2001-01-01T00:00:00.000Z" })];

    expect(filterOrdersInWindow(orders, window)).toHaveLength(1);
    expect(filterOrdersInPreviousWindow(orders, window)).toHaveLength(0);
  });
});

describe("reports summary", () => {
  it("excludes cancelled and refunded from revenue, not from the order count", () => {
    const summary = getReportsSummary([
      order({ id: "a", status: "delivered" }),
      order({ id: "b", status: "cancelled" }),
      order({ id: "c", status: "refunded" }),
    ]);

    expect(summary.revenue).toBe(260);
    expect(summary.orders).toBe(3);
    expect(summary.cancelled).toBe(1);
    expect(summary.refunded).toBe(1);
  });

  it("averages over countable orders only", () => {
    const summary = getReportsSummary([
      order({ id: "a", status: "delivered" }),
      order({ id: "b", status: "cancelled" }),
    ]);

    // 260 revenue over the 1 countable order, not over both.
    expect(summary.averageOrderValue).toBe(260);
  });

  it("counts unique customers case-insensitively", () => {
    const summary = getReportsSummary([
      order({ id: "a" }),
      order({ id: "b", address: { ...order().address, email: "A@Example.com" } } as Partial<PlacedOrder>),
    ]);

    expect(summary.uniqueCustomers).toBe(1);
  });
});

describe("top products", () => {
  it("sums quantity and price*quantity across orders, excluding cancelled", () => {
    const result = getTopProducts([
      order({ id: "a" }),
      order({ id: "b" }),
      order({ id: "c", status: "cancelled" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slug: "choc", quantity: 4, revenue: 400 });
  });
});
