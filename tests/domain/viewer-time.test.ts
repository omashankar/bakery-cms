/**
 * Calendar arithmetic in a viewer's timezone. The failure mode here is never an
 * exception — it is a bucket key that no bucket has, so the orders keyed to it
 * disappear from a chart while still counting in the cards above it.
 */
import { describe, expect, it } from "vitest";

import {
  isValidTimeZone,
  zonedDayKey,
  zonedMidnight,
  zonedParts,
  zonedStartOfDay,
  zonedStartOfMonth,
} from "@/features/orders/lib/viewer-time";

const IST = "Asia/Kolkata";
const NY = "America/New_York";
/** Springs forward at 00:00 local, so midnight itself does not exist that day. */
const SANTIAGO = "America/Santiago";

describe("zonedMidnight", () => {
  it("lands on the requested day in a fixed-offset zone", () => {
    const ms = zonedMidnight(2026, 6, 29, IST);

    expect(zonedDayKey(ms, IST)).toBe("2026-07-29");
    // Midnight IST is 18:30Z the previous day.
    expect(new Date(ms).toISOString()).toBe("2026-07-28T18:30:00.000Z");
  });

  it("lands on the requested day across a spring-forward", () => {
    // 9 Mar 2025 — the US moves 02:00 -> 03:00. Midnight still exists.
    const ms = zonedMidnight(2025, 2, 9, NY);

    expect(zonedDayKey(ms, NY)).toBe("2025-03-09");
    expect(zonedParts(ms, NY).hour).toBe(0);
  });

  it("lands on the requested day across a fall-back", () => {
    // 2 Nov 2025 — 02:00 happens twice in New York.
    const ms = zonedMidnight(2025, 10, 2, NY);

    expect(zonedDayKey(ms, NY)).toBe("2025-11-02");
  });

  it("stays on the requested day in a zone that SKIPS midnight", () => {
    // Santiago springs forward at 00:00 on 7 Sep 2025: there is no 00:00 that
    // day. Resolving it naively lands on 6 Sep and drops a whole day from every
    // daily chart.
    const ms = zonedMidnight(2025, 8, 7, SANTIAGO);

    expect(zonedDayKey(ms, SANTIAGO)).toBe("2025-09-07");
  });

  it("never lands BEFORE a date the zone skipped entirely", () => {
    // Pacific/Apia crossed the date line on 30 Dec 2011 — that date has no
    // instants at all, the zone goes from the 29th straight to the 31st. There
    // is no right answer inside the day, but landing on 29 Dec 23:45 is the
    // wrong SIDE of it, and any bucket seeded there collects the previous day's
    // orders. The forward walk reaches the 31st; a symmetric backward guard used
    // to march it back over the gap and undo that.
    const apia = zonedMidnight(2011, 11, 30, "Pacific/Apia");
    expect(zonedDayKey(apia, "Pacific/Apia") >= "2011-12-30").toBe(true);

    // Same shape: Kiritimati skipped 31 Dec 1994.
    const kiritimati = zonedMidnight(1994, 11, 31, "Pacific/Kiritimati");
    expect(zonedDayKey(kiritimati, "Pacific/Kiritimati") >= "1994-12-31").toBe(true);
  });

  it("still resolves ordinary days in half-hour and quarter-hour zones", () => {
    expect(zonedDayKey(zonedMidnight(2026, 6, 29, "Asia/Kolkata"), "Asia/Kolkata")).toBe(
      "2026-07-29"
    );
    expect(
      zonedDayKey(zonedMidnight(2026, 6, 29, "Australia/Lord_Howe"), "Australia/Lord_Howe")
    ).toBe("2026-07-29");
    expect(zonedDayKey(zonedMidnight(2026, 6, 29, "Asia/Kathmandu"), "Asia/Kathmandu")).toBe(
      "2026-07-29"
    );
  });
});

describe("zonedStartOfDay", () => {
  it("steps by CALENDAR days, so a DST week still has 7 distinct days", () => {
    const afterSpringForward = Date.parse("2025-03-12T16:00:00.000Z");
    const keys = new Set<string>();
    for (let i = 6; i >= 0; i--) {
      keys.add(zonedDayKey(zonedStartOfDay(afterSpringForward, NY, -i), NY));
    }

    // Stepping by a fixed 24h would collapse two of these into one.
    expect(keys.size).toBe(7);
  });
});

describe("zonedStartOfMonth", () => {
  it("walks backwards across a year boundary", () => {
    const march = Date.parse("2026-03-15T12:00:00.000Z");

    expect(zonedDayKey(zonedStartOfMonth(march, "UTC", -3), "UTC")).toBe("2025-12-01");
  });

  it("walks forwards across a year boundary", () => {
    const nov = Date.parse("2025-11-15T12:00:00.000Z");

    expect(zonedDayKey(zonedStartOfMonth(nov, "UTC", 2), "UTC")).toBe("2026-01-01");
  });
});

describe("malformed input", () => {
  it("does not throw on an unparseable timestamp", () => {
    // Intl.formatToParts throws a RangeError on an invalid Date. These run over
    // whole collections, so one bad `placedAt` would 500 every analytics
    // endpoint — the dashboard, reports and all three overview screens at once.
    const bad = new Date("not-a-date").getTime();

    expect(() => zonedDayKey(bad, IST)).not.toThrow();
    expect(() => zonedParts(bad, IST)).not.toThrow();
    expect(() => zonedStartOfDay(bad, IST)).not.toThrow();
  });

  it("recognises real zones and rejects invented ones", () => {
    expect(isValidTimeZone(IST)).toBe(true);
    expect(isValidTimeZone(SANTIAGO)).toBe(true);
    expect(isValidTimeZone("Middle/Earth")).toBe(false);
  });
});
