/**
 * What the shop tells a customer about when their cake arrives.
 *
 * The customer picks a date and one of the shop's configured windows at
 * checkout — "2:00 PM – 4:00 PM" — and the server validates the order against
 * both. That is the promise. Every screen that mentions delivery has to repeat
 * it, not re-derive it.
 *
 * The tracking page derived it instead: an hour either side of
 * `estimatedDelivery`, which for a slot-booked order is
 * `new Date("2026-08-16").toISOString()` — a bare date, parsed as midnight UTC.
 * Rendered in IST that is 5:30 AM, so a customer who had booked an afternoon
 * slot was told, under a heading reading "Time window", that their cake would
 * arrive between 4:30 and 6:30 in the morning.
 *
 * The same midnight-UTC value fed the delivery DATE on three screens, where it
 * reads as the day before anywhere west of UTC.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  formatOrderDeliveryDay,
  getDeliveryTrackingSnapshot,
} from "@/features/orders/lib/delivery-tracking";
import { setActiveLocale } from "@/features/settings/lib/active-locale";
import { formatCalendarDate } from "@/utils/format";
import type { PlacedOrder } from "@/features/orders/lib/orders";

function order(overrides: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: "ord-1",
    orderNumber: "BK-20260811-0001",
    items: [],
    totals: { subtotal: 1200, discount: 0, deliveryFee: 0, tax: 0, total: 1200 },
    address: { fullName: "Asha", email: "a@example.com", city: "Mumbai", pincode: "400001" },
    paymentMethod: "cod",
    paymentStatus: "cod",
    placedAt: "2026-08-11T10:00:00.000Z",
    status: "confirmed",
    statusHistory: [],
    // What the browser stores for a slot booked on the 16th: midnight UTC.
    estimatedDelivery: new Date("2026-08-16").toISOString(),
    deliverySlot: { date: "2026-08-16", timeSlot: "2:00 PM – 4:00 PM" },
    ...overrides,
  } as unknown as PlacedOrder;
}

afterEach(() => {
  setActiveLocale("INR", "Asia/Kolkata");
});

describe("the time window on the tracking page", () => {
  it("is the window the customer booked", () => {
    expect(getDeliveryTrackingSnapshot(order()).etaWindow).toBe("2:00 PM – 4:00 PM");
  });

  it("does not invent an early-morning window out of a timezone offset", () => {
    const { etaWindow } = getDeliveryTrackingSnapshot(order());

    expect(etaWindow).not.toMatch(/AM\s*–/);
    expect(etaWindow).not.toContain("4:30");
  });

  it("says so plainly when no window was ever agreed", () => {
    // A headless COD order with no slot. The shop promised a day, not a time,
    // and a two-hour range around midnight is not an answer.
    const { etaWindow } = getDeliveryTrackingSnapshot(order({ deliverySlot: undefined }));

    expect(etaWindow).toBe("To be confirmed");
  });

  it("keeps saying nothing about a window for a cancelled order", () => {
    expect(getDeliveryTrackingSnapshot(order({ status: "cancelled" })).etaWindow).toBe("—");
  });
});

describe("the delivery date", () => {
  it("is the day the customer picked, in a shop east of UTC", () => {
    setActiveLocale("INR", "Asia/Kolkata");

    expect(formatOrderDeliveryDay(order())).toContain("16");
  });

  it("is still that day in a shop west of UTC", () => {
    // This is the case that was wrong. Midnight UTC on the 16th is 7pm on the
    // 15th in New York, so the confirmation said Saturday while the order said
    // Sunday.
    setActiveLocale("USD", "America/New_York");

    const shown = formatOrderDeliveryDay(order());

    expect(shown, "the booked day slipped backwards across a timezone").toContain("16");
    expect(shown).not.toContain("15");
  });

  it("renders a bare calendar date the same wherever the code is RUNNING", () => {
    /**
     * The machine's own timezone, not the shop's.
     *
     * This is the half that a shop-timezone test cannot see: an
     * `Intl.DateTimeFormat` with no `timeZone` silently uses the runtime's,
     * which on a server is whatever the host was provisioned with. An earlier
     * version of this test only varied `setActiveLocale` and so passed against
     * exactly that bug.
     */
    const realTz = process.env.TZ;
    try {
      const seen = new Set<string>();
      for (const tz of ["Pacific/Midway", "UTC", "Asia/Kolkata", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        seen.add(formatCalendarDate("2026-08-16"));
      }

      expect(seen.size, `the day moved with the machine's clock: ${[...seen].join(" / ")}`).toBe(1);
      expect([...seen][0]).toContain("16");
    } finally {
      if (realTz === undefined) delete process.env.TZ;
      else process.env.TZ = realTz;
    }
  });

  it("falls back to the shop's own timezone for an order with no booked date", () => {
    setActiveLocale("INR", "Asia/Kolkata");

    // A real instant this time — `now + estimatedDeliveryDays` — so it is right
    // to render it in the shop's zone rather than in UTC.
    const shown = formatOrderDeliveryDay(
      order({ deliverySlot: undefined, estimatedDelivery: "2026-08-16T20:00:00.000Z" }),
    );

    // 8pm UTC is 1:30am on the 17th in Kolkata.
    expect(shown).toContain("17");
  });

  it("does not crash on an unusable estimate", () => {
    expect(
      formatOrderDeliveryDay(order({ deliverySlot: undefined, estimatedDelivery: "not-a-date" })),
    ).toBe("Date to be confirmed");
  });
});
