import {
  fractionDigits,
  getActiveLocale,
  localeForCurrency,
  usableCurrencyCode,
} from "@/features/settings/lib/active-locale";

/**
 * Format currency for display, in the currency chosen in General settings.
 *
 * The currency used to be hard-coded to INR here, which made the admin's
 * currency picker decorative — a shop set to USD still priced everything in
 * rupees. Callers may still pass an explicit currency (the server does, where
 * there is no `<html>` to read it from); the locale then follows that currency,
 * so an explicit EUR is grouped and placed the way EUR is written.
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  locale?: string
): string {
  /**
   * The EXPLICIT currency gets the same filter the ambient one already has.
   *
   * `getActiveLocale()` runs every value through `resolve()`, precisely so a
   * settings document written before the Zod enum existed — the model stores it
   * as a bare `String`, so "Rs" is a real possibility — cannot reach `Intl`.
   * The explicit argument skipped that with a bare `??`, and the server always
   * passes one: it reads `general.currency` straight out of the document.
   *
   * A `RangeError: Invalid currency code` from here is not a formatting glitch.
   * It fires while building the WhatsApp notification arguments in `placeOrder`
   * — after the order is committed and the card is charged — so the customer
   * got a 500 on a paid order, no confirmation of any kind was sent, and the
   * bakery was never told. It also turned a legitimate 409 "below the minimum
   * order" refusal into a masked 500, and blanked the Appearance admin screen
   * mid-render. The coupon offers module already wraps this in `usableCurrency`
   * plus a try/catch for exactly this reason; doing it here means no caller has
   * to remember.
   */
  const resolved = usableCurrencyCode(currency) ?? getActiveLocale().currency;
  const digits = fractionDigits(resolved);
  const tag = locale ?? localeForCurrency(resolved);

  // Whole rupees in en-IN, written out without `Intl` — see `formatInrWhole`.
  if (resolved === "INR" && digits === 0 && tag === "en-IN") {
    const written = formatInrWhole(amount);
    if (written !== null) return written;
  }

  // One formatter per locale and currency, not one per price: a listing
  // formats dozens, and each `new Intl.NumberFormat` is a measurable slice of
  // a phone's main thread.
  const key = `${tag}|${resolved}|${digits}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, {
      style: "currency",
      currency: resolved,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

/**
 * A whole number grouped the Indian way — 1,25,000 — without `Intl`.
 */
export function groupIndian(value: number): string {
  const digits = String(Math.round(Math.abs(value)));
  const sign = value < 0 ? "-" : "";
  if (digits.length <= 3) return sign + digits;
  let head = digits.slice(0, -3);
  const groups = [digits.slice(-3)];
  while (head.length > 2) {
    groups.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head) groups.unshift(head);
  return sign + groups.join(",");
}

/**
 * "₹1,25,000" — exactly what `Intl.NumberFormat("en-IN", { style: "currency",
 * currency: "INR", maximumFractionDigits: 0 })` writes, without constructing
 * one.
 *
 * The first `Intl` formatter a page builds in the browser is where it loads
 * the locale data: ~100ms of a phone's main thread, measured in CPU profiles
 * of the product page, the cart and checkout, all of it spent during
 * hydration to print a price. Rupees are this shop's currency and the case
 * almost every page hits, so they skip it. The rules are Intl's own, checked
 * value by value in a test: half away from zero, a minus on any negative
 * input (−0.4 is "-₹0"), Indian grouping. Anything it would get wrong — not
 * finite, or past exact integers — answers null and goes through `Intl`.
 */
export function formatInrWhole(amount: number): string | null {
  if (!Number.isFinite(amount) || Math.abs(amount) >= 1e15) return null;
  const negative = amount < 0 || Object.is(amount, -0);
  const rupees = Math.floor(Math.abs(amount) + 0.5);
  return `${negative ? "-" : ""}₹${groupIndian(rupees)}`;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** A cached `Intl.DateTimeFormat` — see the note on `formatCurrency`. */
function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format a date string for display, in the timezone chosen in General settings.
 *
 * Without an explicit `timeZone` this rendered in whatever zone the machine ran
 * in — the server's, for anything server-rendered — so a 9pm order could show
 * as the previous day to an admin in Kolkata.
 */
/** Shown where a date is missing or unreadable. */
export const NO_DATE = "—";

export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  /**
   * An unusable date must not take the page down.
   *
   * `Intl.DateTimeFormat().format()` throws a RangeError on an Invalid Date,
   * and this is called from 29 places — order lists, review rows, the admin
   * profile — so one record with a blank or malformed date string was a white
   * screen for the whole route. It happened on Admin → Profile, whose empty
   * profile ships `lastLogin: ""` and `createdAt: ""`: every hard load rendered
   * that placeholder before hydration and crashed on it.
   *
   * The same reasoning as `active-locale.ts`, which guards the currency and
   * timezone at the point they meet `Intl` for exactly this: "Guarding at the
   * point of use means no caller can take the site out."
   */
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return NO_DATE;

  const { locale, timezone } = getActiveLocale();
  return dateFormatter(locale, { timeZone: timezone, ...options }).format(parsed);
}

/**
 * A date with no time in it — "2026-08-16", as an `<input type="date">` gives
 * it — rendered as the calendar day it says, in every timezone.
 *
 * `new Date("2026-08-16")` is not that day. It is an INSTANT: midnight UTC.
 * Render that instant anywhere west of UTC and it is the day before, so a
 * customer in London booking a Sunday delivery had their order confirmed for
 * Saturday, on the review step, on the tracking page, and nowhere else — the
 * order itself still said Sunday, because the string was stored verbatim.
 *
 * Anything that is genuinely an instant (a placed-at timestamp) belongs in
 * `formatDate`, which renders in the shop's configured timezone. This one is
 * for the dates that have no time to render.
 */
export function formatCalendarDate(
  day: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  }
): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  // Not a bare calendar date. Whatever it is, it carries a time, so it is an
  // instant and belongs in the shop's timezone rather than in UTC.
  if (!parts) return formatDate(day, options);

  const [, year, month, date] = parts;
  const { locale } = getActiveLocale();
  return dateFormatter(locale, { timeZone: "UTC", ...options }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)))
  );
}

/**
 * Format relative time (e.g. "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  // Every comparison below is false against NaN, so an unusable date fell all
  // the way through to `formatDate` — which used to throw. Answered here so the
  // reason is stated where it is decided rather than inherited.
  if (Number.isNaN(then)) return NO_DATE;
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Get initials from a name string
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
