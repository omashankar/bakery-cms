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
  /**
   * A lead time of ZERO is still a floor.
   *
   * This read `|| leadDays <= 0` and returned false, so a shop that delivers
   * same-day had no date check at all: the only two callers — the quote in
   * `checkout.controller` and `placeOrder` — accepted `2020-01-01` as happily
   * as tomorrow, and the browser's `min=` on the date input was the whole
   * defence, which a direct POST does not have.
   *
   * Zero means “today is early enough”, not “any day will do”. The arithmetic
   * below is already right for it: `earliestDeliveryDateString` clamps to
   * today, and the one day of slack then refuses anything before yesterday.
   */
  if (!chosen || !Number.isFinite(leadDays)) return false;
  const floor = earliestDeliveryDateString(leadDays, now);
  return chosen < addDays(floor, -1);
}

/**
 * Is this one of the slots the shop actually offers?
 *
 * `commerce.deliveryTimeSlots` was read in exactly two places — the admin page
 * that edits it, and the storefront dropdown that renders it. Nothing on the
 * server ever looked at it, so a slot the bakery had REMOVED (because nobody is
 * there at 8pm any more) was still accepted from a tab opened before the
 * change, or from a direct POST — and then printed on the invoice, pushed into
 * the WhatsApp alert, and shown on the order screen as a delivery the shop is
 * expected to make.
 *
 * Forgiving about how the same slot is written and strict about which slots
 * exist: case, surrounding and inner whitespace, and the choice of hyphen or
 * dash are all normalised, because "10:00 AM - 12:00 PM" typed by hand is the
 * same delivery window as the stored "10:00 AM – 12:00 PM".
 *
 * An empty `offered` list means the shop has not defined slots, so there is
 * nothing to check against — and a blank choice is always allowed, since the
 * customer may simply not have picked one.
 */
export function normaliseTimeSlot(slot: string): string {
  return slot
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

export function isOfferedTimeSlot(chosen: string, offered: readonly string[]): boolean {
  const wanted = normaliseTimeSlot(chosen);
  if (!wanted) return true;

  const list = offered.map(normaliseTimeSlot).filter(Boolean);
  if (list.length === 0) return true;

  return list.includes(wanted);
}

/**
 * The minute a slot's window closes, as minutes past midnight. Null if the
 * shop's wording does not say.
 *
 * A slot is free text — the admin types the list — so this reads what it can
 * and declines to guess at the rest. “10:00 AM – 12:00 PM” and “10:00 - 12:00”
 * both parse; “Evening” does not, and an unparseable slot is left alone rather
 * than refused, which is the same choice `isOfferedTimeSlot` makes for a shop
 * that has defined no slots at all.
 */
export function timeSlotEndsAt(slot: string): number | null {
  const text = normaliseTimeSlot(slot);
  if (!text) return null;

  const meridiem = [...text.matchAll(/(\d{1,2}):(\d{2})\s*(am|pm)/g)];
  const last = meridiem.at(-1);
  if (last) {
    // 12am is midnight and 12pm is noon: the hour wraps, the half-day does not.
    const hour = (Number(last[1]) % 12) + (last[3] === "pm" ? 12 : 0);
    return hour * 60 + Number(last[2]);
  }

  // No am/pm anywhere: read it as a 24-hour clock rather than assuming.
  const plain = [...text.matchAll(/(\d{1,2}):(\d{2})/g)].at(-1);
  if (!plain) return null;
  const hour = Number(plain[1]);
  const minute = Number(plain[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Minutes past midnight, on the LOCAL clock — the one the shop bakes on. */
function minutesIntoDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Has this delivery window already closed?
 *
 * Only TODAY can be in the past — a date before today is `isBeforeLeadTime`'s
 * question, and a later date has no window that has passed yet.
 *
 * Nothing filtered slots by the clock: the picker rendered every stored window
 * unconditionally and the server checked only that the wording was one the shop
 * offers. So a shop with no preparation lead — which is what “same-day” means —
 * took an order at 11pm for that morning's 10:00 AM – 12:00 PM delivery, printed
 * it on the invoice and pushed it to the kitchen as a delivery it owes.
 */
export function isPastTimeSlot(
  chosen: string,
  timeSlot: string,
  now: Date = new Date(),
): boolean {
  if (!chosen || !timeSlot) return false;
  if (chosen !== todayAsDateString(now)) return false;

  const closes = timeSlotEndsAt(timeSlot);
  if (closes === null) return false;

  return minutesIntoDay(now) >= closes;
}

/**
 * Has the shop stopped taking orders for today?
 *
 * `commerce.sameDayCutoff` is the shop's own answer to “how late can somebody
 * ask for today”, and it drove a countdown on the product page and NOTHING else
 * — the same shape as `deliveryTimeSlots` before the server learned to read it,
 * and as `minOrderValue` before that. A setting the shop can edit and the shop
 * cannot enforce is worse than no setting, because it reads like a rule.
 *
 * Empty means the shop has named no cutoff, so there is nothing to enforce; a
 * date that is not today is not a same-day order and is none of this rule's
 * business. The format is the one the admin field validates, `HH:MM`.
 */
export function isPastSameDayCutoff(
  chosen: string,
  cutoff: string,
  now: Date = new Date(),
): boolean {
  if (!chosen || !cutoff) return false;
  if (chosen !== todayAsDateString(now)) return false;

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(cutoff.trim());
  if (!match) return false;

  return minutesIntoDay(now) >= Number(match[1]) * 60 + Number(match[2]);
}
