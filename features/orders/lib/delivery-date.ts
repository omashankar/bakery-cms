/**
 * Delivery dates as plain calendar strings, on both sides of the wire.
 *
 * A delivery slot is a `YYYY-MM-DD` — a day in the customer's calendar, with no
 * instant behind it. Every attempt to reason about it with `Date` arithmetic
 * introduces a timezone the value never had, and the two sides pick different
 * ones:
 *
 *   client: new Date() -> setHours(0,0,0,0) -> setDate(+N) -> toISOString()
 *           builds LOCAL midnight and reads it back as UTC, so in IST the string
 *           is one day EARLIER than the day computed.
 *   server: new Date("YYYY-MM-DD") is UTC midnight, compared against a
 *           server-LOCAL midnight + N.
 *
 * The result was the picker offering exactly the date the server rejected — and
 * the rejection lands in `placeOrder`, which runs after the card is captured. A
 * customer in India could not order at all for any zone whose lead time exceeded
 * the shop-wide one, and the webhook retried the same doomed placement until
 * Razorpay gave up.
 *
 * So: no Date maths. Add days to the calendar directly, and compare the strings.
 */

/** Today in the LOCAL calendar, as `YYYY-MM-DD`. Never via `toISOString()`. */
export function todayAsDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` plus whole days, staying in the calendar. */
export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return dateString;

  // UTC only as an arithmetic device — in, add, out. Nothing is ever read back
  // through a local getter, so no offset can shift the answer.
  const stamp = Date.UTC(year, month - 1, day) + days * 86_400_000;
  return new Date(stamp).toISOString().split("T")[0] ?? dateString;
}

/** The earliest `YYYY-MM-DD` the shop will accept, given a lead time in days. */
export function earliestDeliveryDateString(leadDays: number, now: Date = new Date()): string {
  const days = Number.isFinite(leadDays) ? Math.max(0, Math.trunc(leadDays)) : 0;
  return addDays(todayAsDateString(now), days);
}

/**
 * Is the chosen day too early for this lead time?
 *
 * Lenient by one day, deliberately. The customer's calendar and the server's can
 * legitimately differ by a day — a shop in India served from a UTC host, a
 * customer travelling — and this check runs where a refusal is most expensive:
 * after the payment has been captured. A day of slack cannot be gamed (a
 * five-day zone still refuses same-day) and it cannot strand a real order.
 */
export function isBeforeLeadTime(
  chosen: string,
  leadDays: number,
  now: Date = new Date(),
): boolean {
  if (!chosen || !Number.isFinite(leadDays) || leadDays <= 0) return false;
  const floor = earliestDeliveryDateString(leadDays, now);
  return chosen < addDays(floor, -1);
}
