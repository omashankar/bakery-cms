/**
 * Converting between an `<input type="date">` value and a stored expiry instant.
 *
 * A bare ISO date string parses as UTC: `new Date("2026-12-31")` is
 * 2026-12-31T00:00:00.000Z. Stored that way and compared with `expiresAt < now`,
 * a coupon an admin set to expire on 31 December stopped working at 05:30 IST on
 * 31 December — dead for the entire day they had advertised as its last. The
 * customer typed the code they had been given and paid full price.
 *
 * "Expires on the 31st" means the end of the 31st, in the shop's own timezone.
 */

/** The stored instant for a date the admin picked, or undefined for no expiry. */
export function toExpiryInstant(date: string | null | undefined): string | undefined {
  const trimmed = date?.trim();
  if (!trimmed) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    // Already a full timestamp, or something unrecognised — keep it only if it
    // is a real instant, so an unparseable value cannot become "never expires".
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const [, year, month, day] = match;
  // Local end of that day: 23:59:59.999 where the shop is, not 00:00 UTC.
  const end = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  return end.toISOString();
}

/** The stored instant as the date the admin picked, for the form field. */
export function toExpiryInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Whether a stored expiry has passed.
 *
 * An unparseable value counts as EXPIRED, not as "never expires". Both checks in
 * this repo did `new Date(value).getTime() < now`, and `NaN < now` is false — so
 * a coupon with `expiresAt: "31/12/2026"` was permanently live. A misconfigured
 * expiry should fail closed: refusing a discount is recoverable, giving one away
 * for ever is not.
 */
export function hasExpired(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return true;
  return time < now;
}
