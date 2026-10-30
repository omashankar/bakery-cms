"use client";

import { useEffect, useState } from "react";

import {
  addDays,
  shopClockNow,
  timeSlotEndsAt,
  timeSlotStartsAt,
  todayAsDateString,
} from "@/features/orders/lib/delivery-date";
import { getActiveLocale } from "@/features/settings/lib/active-locale";

export type SlotUrgency = "overdue" | "today" | "tomorrow" | "later";

/** The shop's own clock: its date, tomorrow's date, and the minute of the day. */
export interface ShopClock {
  today: string;
  tomorrow: string;
  minutes: number;
}

function readShopClock(): ShopClock {
  const wall = shopClockNow(getActiveLocale().timezone);
  const today = todayAsDateString(wall);
  return { today, tomorrow: addDays(today, 1), minutes: wall.getHours() * 60 + wall.getMinutes() };
}

/**
 * The shop's clock, known only after the page has mounted.
 *
 * Rendering a date-relative word on the server and again in the browser can
 * disagree around midnight (or across time zones) and break hydration, so the
 * first render says nothing and the badge appears a moment later. Ticks every
 * minute, so a window that closes while the tablet sits on the counter turns
 * late without a reload.
 */
export function useShopToday(): ShopClock | null {
  const [value, setValue] = useState<ShopClock | null>(null);
  useEffect(() => {
    const read = () => setValue(readShopClock());
    const first = setTimeout(read, 0);
    const timer = setInterval(read, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return value;
}

type Slot = { date: string; timeSlot?: string } | undefined;

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * How close a delivery is. A slot is late once its DAY has gone — or, today,
 * once its window has closed: the 10–12 cake is late at 12:05, not tomorrow.
 */
export function slotUrgency(slot: Slot, clock: ShopClock | null): SlotUrgency | null {
  const date = slot?.date;
  if (!date || !clock || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < clock.today) return "overdue";
  if (date === clock.today) {
    const closes = slot?.timeSlot ? timeSlotEndsAt(slot.timeSlot) : null;
    return closes !== null && clock.minutes >= closes ? "overdue" : "today";
  }
  if (date === clock.tomorrow) return "tomorrow";
  return "later";
}

/** The badge's words: how late, in days, so a forgotten order reads as one. */
export function urgencyLabel(urgency: SlotUrgency, slot: Slot, clock: ShopClock | null): string {
  if (urgency === "today") return "Today";
  if (urgency === "tomorrow") return "Tomorrow";
  if (urgency !== "overdue") return "";
  const days = slot?.date && clock ? daysBetween(slot.date, clock.today) : 0;
  if (days <= 0) return "Late";
  return days === 1 ? "1 day late" : `${days} days late`;
}

/**
 * Soonest delivery first — by date, then by when the window OPENS, read as a
 * time rather than as text. No slot sorts last; ties keep the order they were
 * placed in.
 */
export function bySlot(
  a: { deliverySlot?: { date: string; timeSlot?: string }; placedAt: string },
  b: { deliverySlot?: { date: string; timeSlot?: string }; placedAt: string },
): number {
  const da = a.deliverySlot?.date ?? "9999-12-31";
  const db = b.deliverySlot?.date ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.deliverySlot?.timeSlot ? (timeSlotStartsAt(a.deliverySlot.timeSlot) ?? 24 * 60) : 24 * 60;
  const tb = b.deliverySlot?.timeSlot ? (timeSlotStartsAt(b.deliverySlot.timeSlot) ?? 24 * 60) : 24 * 60;
  if (ta !== tb) return ta - tb;
  return a.placedAt < b.placedAt ? -1 : a.placedAt > b.placedAt ? 1 : 0;
}
