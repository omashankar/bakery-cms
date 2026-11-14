/**
 * THE KITCHEN MAKES THE SOONEST CAKE FIRST, AND SEES WHAT IS LATE.
 *
 * A delivery window is free text — “9:00 AM – 11:00 AM”. Sorted as text, “9”
 * comes after “1”, so the 9 o'clock cake sat below the noon one on the kitchen
 * and the rider's lists. And a slot was only “overdue” once its whole DAY had
 * gone: the 10–12 cake still read “Today” at 3 in the afternoon.
 */
import { describe, expect, it } from "vitest";

import { timeSlotStartsAt } from "@/features/orders/lib/delivery-date";
import { bySlot, slotUrgency, urgencyLabel, type ShopClock } from "@/apps/admin/fulfilment/lib/slot-urgency";

const order = (date: string | null, timeSlot: string, placedAt = "2026-10-01T00:00:00Z") => ({
  placedAt,
  ...(date ? { deliverySlot: { date, timeSlot } } : {}),
});

const clock = (minutes: number): ShopClock => ({ today: "2026-10-30", tomorrow: "2026-10-31", minutes });

describe("the order of the kitchen's list", () => {
  it("reads a window's start as a time, not as text", () => {
    expect(timeSlotStartsAt("9:00 AM – 11:00 AM")).toBe(9 * 60);
    expect(timeSlotStartsAt("12:00 PM – 2:00 PM")).toBe(12 * 60);
    expect(timeSlotStartsAt("12:00 AM – 2:00 AM")).toBe(0);
    expect(timeSlotStartsAt("18:30 - 20:00")).toBe(18 * 60 + 30);
    expect(timeSlotStartsAt("Evening")).toBeNull();
  });

  it("puts the morning cake above the noon one on the same day", () => {
    const noon = order("2026-10-30", "12:00 PM – 2:00 PM");
    const morning = order("2026-10-30", "9:00 AM – 11:00 AM");
    const evening = order("2026-10-30", "6:00 PM – 8:00 PM");
    expect([noon, evening, morning].sort(bySlot)).toEqual([morning, noon, evening]);
  });

  it("sorts by day first, and an order with no slot last", () => {
    const tomorrowMorning = order("2026-10-31", "9:00 AM – 11:00 AM");
    const todayEvening = order("2026-10-30", "6:00 PM – 8:00 PM");
    const noSlot = order(null, "");
    expect([noSlot, tomorrowMorning, todayEvening].sort(bySlot)).toEqual([todayEvening, tomorrowMorning, noSlot]);
  });

  it("keeps the order they were placed in when the slots match", () => {
    const first = order("2026-10-30", "10:00 AM – 12:00 PM", "2026-10-28T09:00:00Z");
    const second = order("2026-10-30", "10:00 AM – 12:00 PM", "2026-10-29T09:00:00Z");
    expect([second, first].sort(bySlot)).toEqual([first, second]);
  });
});

describe("what is late", () => {
  const slot = { date: "2026-10-30", timeSlot: "10:00 AM – 12:00 PM" };

  it("is late once today's window has closed, not only once the day has gone", () => {
    expect(slotUrgency(slot, clock(11 * 60 + 59))).toBe("today");
    expect(slotUrgency(slot, clock(12 * 60))).toBe("overdue");
  });

  it("an unreadable window stays 'today' all day rather than guessing", () => {
    expect(slotUrgency({ date: "2026-10-30", timeSlot: "Evening" }, clock(23 * 60))).toBe("today");
  });

  it("says how late, so a forgotten order reads as one", () => {
    expect(urgencyLabel("overdue", slot, clock(13 * 60))).toBe("Late");
    expect(urgencyLabel("overdue", { date: "2026-10-29", timeSlot: "" }, clock(0))).toBe("1 day late");
    expect(urgencyLabel("overdue", { date: "2026-08-21", timeSlot: "" }, clock(0))).toBe("70 days late");
    expect(urgencyLabel("today", slot, clock(0))).toBe("Today");
    expect(urgencyLabel("tomorrow", slot, clock(0))).toBe("Tomorrow");
  });

  it("says nothing before the shop's clock is known", () => {
    expect(slotUrgency(slot, null)).toBeNull();
  });
});
