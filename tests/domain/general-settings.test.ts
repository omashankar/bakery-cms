/**
 * General settings that were stored and then read by nothing.
 *
 * `currency` and `timezone` both saved to Mongo, both round-tripped through the
 * API, and neither reached a single pixel: `formatCurrency` hard-coded INR/en-IN
 * and `formatDate` hard-coded en-IN with no `timeZone`, so it rendered in
 * whatever zone the machine happened to run in — the server's, for anything
 * server-rendered.
 *
 * The resolution has to agree between the server render and the hydration pass,
 * or every price in the app is a hydration mismatch for any shop not on the INR
 * default. The root layout publishes the pair with `setActiveLocale`, and
 * `LocaleSync` republishes it inside the client module graph, which renders
 * client components during SSR from its own copy of every module.
 */
import { afterEach, describe, expect, it } from "vitest";

import { formatCurrency, formatDate } from "@/utils/format";
import { getActiveLocale, setActiveLocale } from "@/features/settings/lib/active-locale";
import { isSafeAssetUrl, defaultGeneralSettings } from "@/features/settings/lib/settings-utils";

afterEach(() => {
  setActiveLocale(defaultGeneralSettings.currency, defaultGeneralSettings.timezone);
});

/** Intl separates an amount from a trailing symbol with U+00A0, not a space. */
function normalise(value: string): string {
  return value.replace(/ /g, " ");
}

describe("the configured currency", () => {
  it("formats prices in the currency the admin chose", () => {
    setActiveLocale("INR", "Asia/Kolkata");
    expect(formatCurrency(1250)).toBe("₹1,250");

    // The whole point of the setting: a shop on USD must not price in rupees.
    setActiveLocale("USD", "America/New_York");
    expect(formatCurrency(1250)).toBe("$1,250.00");

    setActiveLocale("GBP", "Europe/London");
    expect(formatCurrency(1250)).toBe("£1,250.00");
  });

  it("shows minor units for currencies that have them, and not for rupees", () => {
    setActiveLocale("INR", "Asia/Kolkata");
    expect(formatCurrency(1250.5)).toBe("₹1,251");

    setActiveLocale("USD", "Asia/Kolkata");
    expect(formatCurrency(1250.5)).toBe("$1,250.50");
  });

  it("lets an explicit currency win, for callers outside a page render", () => {
    // Order confirmation emails are formatted in a route handler, which never
    // renders the root layout — so that path passes the store currency itself,
    // and the grouping then follows that currency rather than the page's.
    setActiveLocale("INR", "Asia/Kolkata");
    expect(normalise(formatCurrency(1250, "EUR"))).toBe("1.250,00 €");
  });

  it("falls back to the default rather than throwing when nothing was published", () => {
    expect(formatCurrency(1250)).toBe("₹1,250");
  });

  it("never lets a currency Intl does not know reach a render", () => {
    // The Zod enum only constrains FUTURE writes. `currency` was free text for
    // the life of the project and the model stores a bare String, so a document
    // can hold "Rs" — and `Intl.NumberFormat` throws a RangeError on an unknown
    // code, which from a settings value would take down every rendered page.
    setActiveLocale("Rs", "Mars/Olympus");
    expect(() => formatCurrency(10)).not.toThrow();
    expect(() => formatDate("2026-07-30T20:30:00.000Z")).not.toThrow();
  });

  it("treats an empty currency or timezone as the default, never as an empty code", () => {
    // A half-written settings document must not reach `Intl`, which throws a
    // RangeError on an empty currency code — that would take out every price.
    setActiveLocale("", "");
    expect(getActiveLocale().currency).toBe(defaultGeneralSettings.currency);
    expect(() => formatCurrency(10)).not.toThrow();
  });
});

describe("the configured timezone", () => {
  it("renders a date in the store's zone, not the machine's", () => {
    // 2026-07-30T20:30:00Z is already the 31st in Kolkata (+05:30) and still the
    // 30th in New York (-04:00). Before this the answer depended on the clock of
    // whatever machine happened to render it.
    const instant = "2026-07-30T20:30:00.000Z";

    setActiveLocale("INR", "Asia/Kolkata");
    expect(formatDate(instant)).toBe("31 Jul 2026");

    setActiveLocale("INR", "America/New_York");
    expect(formatDate(instant)).toBe("30 Jul 2026");
  });

  it("keeps the caller's own date options while adding the zone", () => {
    setActiveLocale("INR", "Asia/Kolkata");
    expect(formatDate("2026-07-30T20:30:00.000Z", { day: "2-digit", month: "2-digit" })).toBe(
      "31/07"
    );
  });
});

describe("the logo and favicon fields", () => {
  it("accepts what is safe to put in an href, and refuses the rest", () => {
    expect(isSafeAssetUrl("")).toBe(true);
    expect(isSafeAssetUrl("/images/logo.svg")).toBe(true);
    expect(isSafeAssetUrl("https://cdn.example/logo.svg")).toBe(true);

    expect(isSafeAssetUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAssetUrl("data:text/html;base64,PHN2Zz4=")).toBe(false);
    expect(isSafeAssetUrl("//evil.example/logo.svg")).toBe(false);
  });

  it("defaults the logo to empty, because no default logo file is shipped", () => {
    // It used to default to "/images/logo.svg", which is a 404 — rendering that
    // would put a broken image in the storefront navbar of every fresh install.
    expect(defaultGeneralSettings.logo).toBe("");
  });
});
