/**
 * One unreadable date used to be a white screen.
 *
 * `Intl.DateTimeFormat().format()` throws a RangeError on an Invalid Date, and
 * `formatDate` handed it `new Date(value)` unchecked. It is called from ~29
 * places — order lists, review rows, customer tables, the admin profile — so
 * any single record with a blank or malformed date string took the whole route
 * down with "Invalid time value".
 *
 * It fired on Admin → Profile. `persistServerAccount` writes `lastLogin` and
 * `createdAt` from `/api/auth/me`, and is deliberately NOT part of the
 * hydration gate — "a failed read leaves them blank rather than blocking a
 * save". So when that call returned null (an expired token, a 401, a network
 * blip) the gate opened, the page rendered `formatDate("")`, and crashed.
 *
 * The profile lib had already described the intended behaviour: "Blank until
 * the server answers — which the screen renders as an em dash, an honest 'not
 * known yet' rather than a plausible date." The dash was the design; the
 * formatter threw instead of producing it.
 *
 * Same reasoning as `active-locale.ts`, which guards the currency and timezone
 * where they meet `Intl` for exactly this: "Guarding at the point of use means
 * no caller can take the site out."
 */
import { afterEach, describe, expect, it } from "vitest";

import { formatDate, formatRelativeTime, NO_DATE } from "@/utils/format";
import { setActiveLocale } from "@/features/settings/lib/active-locale";

afterEach(() => {
  setActiveLocale("INR", "Asia/Kolkata");
});

describe("a date the app cannot read", () => {
  const unusable = ["", "   ", "not-a-date", "0000-00-00", "undefined", "null"];

  it("never throws out of formatDate", () => {
    for (const value of unusable) {
      expect(() => formatDate(value), `formatDate(${JSON.stringify(value)}) threw`).not.toThrow();
      expect(formatDate(value)).toBe(NO_DATE);
    }
  });

  it("never throws out of formatRelativeTime", () => {
    for (const value of unusable) {
      expect(() => formatRelativeTime(value)).not.toThrow();
      expect(formatRelativeTime(value)).toBe(NO_DATE);
    }
  });

  it("survives an Invalid Date object, not just a bad string", () => {
    expect(() => formatDate(new Date("nonsense"))).not.toThrow();
    expect(formatDate(new Date("nonsense"))).toBe(NO_DATE);
  });

  it("survives whatever options the caller passes", () => {
    // The admin profile passes none; other callers pass weekday/long forms.
    expect(formatDate("", { weekday: "long", day: "numeric", month: "long" })).toBe(NO_DATE);
  });
});

describe("a date the app can read", () => {
  it("still formats normally", () => {
    setActiveLocale("INR", "Asia/Kolkata");
    const shown = formatDate("2026-08-11T11:54:48.704Z");

    expect(shown).not.toBe(NO_DATE);
    expect(shown).toContain("2026");
  });

  it("still reports recent times relatively", () => {
    const shown = formatRelativeTime(new Date(Date.now() - 5 * 60_000));

    expect(shown).toBe("5m ago");
  });
});

describe("the admin profile screen", () => {
  it("asks for dates the server may not have answered for yet", async () => {
    // The two calls that crashed. Kept as a check that they still go through
    // the guarded formatter rather than being hand-rolled around it.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const page = readFileSync(
      join(process.cwd(), "apps/admin/profile/components/admin-profile-page.tsx"),
      "utf8",
    );

    expect(page).toContain("formatDate(profile.lastLogin)");
    expect(page).toContain("formatDate(profile.createdAt)");
    // And the blanks it may be handed are still blanks, not invented dates.
    expect(page).toContain('lastLogin: ""');
    expect(page).toContain('createdAt: ""');
  });
});
