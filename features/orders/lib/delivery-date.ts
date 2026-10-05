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
 * `HH:MM` on a 24-hour clock — the one format the admin's cutoff field writes.
 *
 * ONE COPY, because three functions in this file now read the same stored
 * string, and a regex that drifts between them is a cutoff counted down to at
 * one time and enforced at another. Two further copies live outside this file
 * — the admin field's own check and `commerceSchema` — and those guard a
 * WRITE, which is a different job from reading one back.
 *
 * No `g` flag, so it carries no `lastIndex` and is safe to share.
 */
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

  const match = HH_MM.exec(cutoff.trim());
  if (!match) return false;

  return minutesIntoDay(now) >= Number(match[1]) * 60 + Number(match[2]);
}

/**
 * How long is left before same-day orders close, as `HH:MM:SS`.
 *
 * MOVED HERE UNCHANGED from apps/website/lib/product-details.ts. It had to
 * move: `domainStaysPure` (eslint.config.mjs, `ignores: []`, with the note
 * that nothing under features/ has ever had a legitimate exemption) forbids
 * anything under features/ from importing an app's UI layer, and the homepage
 * section renderer — a domain module — now draws the same countdown. The
 * alternative was a second copy of the arithmetic, which is how one shop ends
 * up publishing two deadlines that disagree.
 *
 * It belonged here anyway: `isPastSameDayCutoff` directly above is the same
 * stored string read for the other half of the job, ENFORCEMENT, and the two
 * were sitting in different layers.
 *
 * A pure function of the cutoff and the clock, so the arithmetic can be
 * tested without waiting for a second to pass. Null means say nothing, and
 * there are three ways to get it: the shop has named no cutoff, the string is
 * not a time, or today's has already gone. That last one matters most — a
 * countdown that has run out is worse than none, because it is still on the
 * page telling a customer to hurry for a delivery they can no longer have.
 */
export function timeLeftToday(cutoff: string, now: Date): string | null {
  const match = HH_MM.exec(cutoff.trim());
  if (!match) return null;

  const closes = new Date(now);
  closes.setHours(Number(match[1]), Number(match[2]), 0, 0);

  const seconds = Math.floor((closes.getTime() - now.getTime()) / 1000);
  if (seconds <= 0) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

/**
 * The cutoff worth counting down to, or "" — the shop's TWO facts in one place.
 *
 * A cutoff on its own is not a deadline. `deliveryLeadDays` decides whether
 * today can be ordered at all, and on a shop with a lead time of 1 a stored
 * 14:00 is about when TOMORROW'S orders close — a different sentence. A band
 * counting down to it would be promising a delivery the shop's own date picker
 * refuses. The product page has had exactly that bug since its countdown
 * shipped: it reads `sameDayCutoff` and never consults the lead time.
 *
 * A bad FORMAT is refused here too, not just downstream. The reader would
 * refuse it anyway, but a server that knowingly ships a string it has already
 * judged unusable is one edit away from somebody interpolating it into copy.
 *
 * Collapsed into ONE string rather than shipping both numbers to the browser,
 * so a second reader cannot re-derive the rule differently. "" means draw
 * nothing, and every caller treats it that way.
 */
export function sameDayCutoffFor(cutoff: string | undefined, leadDays: number): string {
  if (!Number.isFinite(leadDays) || leadDays > 0) return "";
  const named = (cutoff ?? "").trim();
  return HH_MM.test(named) ? named : "";
}

/**
 * `new Date()` as the SHOP'S clock reads it, not the visitor's.
 *
 * "14:00" means 14:00 where the shop is. Run on the browser's clock, somebody
 * in London ordering for family in Kota is shown four and a half hours that do
 * not exist — and on a gifting storefront that customer is the business, not
 * the edge case. `general.timezone` is already stored and already filtered
 * through `getActiveLocale`, so nothing new has to be invented to know this.
 *
 * A WALL CLOCK, not an instant, and the one exception to this file's header.
 * That header forbids `Date` arithmetic because a DELIVERY DATE is a calendar
 * string with no instant behind it, and every attempt to reason about one with
 * `Date` smuggled in a timezone. This is the opposite problem: a duration
 * between two moments on one clock face. The returned Date's LOCAL getters
 * read the shop's hour, minute and second and its absolute value is
 * meaningless — which is exactly what `timeLeftToday` needs, because it only
 * ever compares the Date against a copy of itself with the hours replaced.
 * Both sides sit in the same frame, so the difference is the true wall-clock
 * difference. Same "arithmetic device, in and out, never read back through a
 * getter that cares" the header already allows for `addDays`.
 *
 * An unusable timezone cannot arrive from `getActiveLocale`, which filters it
 * — but a caller passing one straight through would take the page down from
 * inside a render, so the visitor's own clock is the fallback. That is the OLD
 * behaviour: wrong for a distant visitor rather than fatal for everyone.
 */
export function shopClockNow(timezone: string, now: Date = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(now);

    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);

    const wall = new Date(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second"),
      0,
    );
    return Number.isNaN(wall.getTime()) ? now : wall;
  } catch {
    return now;
  }
}

/**
 * The same answer split into the boxes a countdown draws, plus the one
 * sentence a screen reader is given.
 *
 * Parsed back out of `HH:MM:SS` rather than computed a second time, so there
 * is one piece of arithmetic behind both the product page's line and the
 * homepage's band. Strict about the shape deliberately: anything that is not
 * that format is null and the band draws nothing — never three boxes reading
 * `NaN`, which is what a `slice()` on a changed format would give.
 *
 * `spoken` DROPS THE SECONDS. A sentence that changes every second is either
 * never announced or unusable; this one is never announced (the region is not
 * live — see the band), and what is left stays true for a minute rather than
 * for a tick.
 */
export function countdownParts(
  left: string | null,
): { hours: string; minutes: string; seconds: string; spoken: string } | null {
  const match = left ? /^(\d{2}):([0-5]\d):([0-5]\d)$/.exec(left) : null;
  if (!match) return null;

  const [, hours, minutes, seconds] = match;
  const say = (value: string, unit: string) =>
    `${Number(value)} ${Number(value) === 1 ? unit : `${unit}s`}`;

  return {
    hours,
    minutes,
    seconds,
    spoken:
      Number(hours) > 0
        ? `${say(hours, "hour")} ${say(minutes, "minute")} left`
        : Number(minutes) > 0
          ? `${say(minutes, "minute")} left`
          : // "0 minutes left" is not what 40 seconds is.
            "less than a minute left",
  };
}

/**
 * WHICH UNITS THE CLOCK SHOWS — and which ones is itself part of the fact.
 *
 * A fixed hours/minutes/seconds triple carries a "00" for most of the day: a
 * cell whose entire content is the ABSENCE of a unit, given the same width and
 * the same weight as the ones that mean something. It also puts SECONDS on the
 * page six hours out, where a digit changes 3,600 times before anything a
 * customer can act on has changed at all.
 *
 * ONE RULE: drop the leading units that are still zero, then keep at most two.
 * 05:12:09 reads hours and minutes, 00:12:09 reads minutes and seconds, and
 * 00:00:09 reads seconds alone. So the LEADING cell is never "00" — a trailing
 * one still can be, and should: "01 hours 00 minutes" is a reading, where "00
 * hours" is a unit that is not there.
 *
 * `timeLeftToday` returns null at or past the cutoff, so `countdownParts` is
 * non-null only while at least one unit is non-zero and `findIndex` cannot
 * miss. `Math.max(…, 0)` is insurance against a later change there: -1 would
 * slice to an empty clock, which is a band of digits with no digits in it.
 *
 * HERE RATHER THAN IN THE BAND, beside `spoken`, which has carried the same
 * three words since it was written — so the rule can be asserted without a DOM,
 * and mutated red, which a className scanned out of a source file cannot be.
 */
export function countdownCells(parts: {
  hours: string;
  minutes: string;
  seconds: string;
}): readonly (readonly [string, string])[] {
  const units = [
    ["Hours", parts.hours],
    ["Minutes", parts.minutes],
    ["Seconds", parts.seconds],
  ] as const;

  const lead = Math.max(
    units.findIndex(([, value]) => Number(value) > 0),
    0,
  );
  return units.slice(lead, lead + 2);
}
