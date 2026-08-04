/**
 * Calendar arithmetic in the VIEWER's timezone.
 *
 * These take an IANA zone name ("Asia/Kolkata"), not a numeric offset. An offset
 * is a single instant's worth of information: a zone that observes DST has two
 * of them, so one sampled "now" and applied across a whole range puts every day
 * on the far side of the transition in the wrong bucket. Only the zone itself
 * can answer "which calendar day was this instant?" for every instant.
 *
 * The zone is passed in rather than read from the environment because this runs
 * on the server, where "local" is the server's timezone — "the last 7 days"
 * would otherwise mean the server's days, not the admin's.
 */

/** Falls back to UTC, which is at least deterministic and DST-free. */
export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cached because these screens format thousands of timestamps per request.
 *
 * Keyed on the RESOLVED zone name, not the caller's string: Intl accepts any
 * casing, so "asia/kolkata" and "ASIA/KOLKATA" would otherwise each take a slot
 * in a module-level map that is never evicted.
 */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const key = timeZone.toLowerCase();
  let formatter = partsFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(key, formatter);
  }
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number; // 0-indexed, like Date
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * The wall-clock reading in `timeZone` at instant `ms`.
 *
 * `ms` is coerced to a finite number first: `Intl.formatToParts` THROWS a
 * RangeError on an invalid Date, and these run over whole collections. A single
 * order with a malformed `placedAt` would otherwise 500 every analytics
 * endpoint, taking the dashboard, reports and all three overview screens with
 * it. Falling back to the epoch keeps that one row out of every bucket instead.
 */
export function zonedParts(ms: number, timeZone: string): ZonedParts {
  const safe = Number.isFinite(ms) ? ms : 0;
  const parts = partsFormatter(timeZone).formatToParts(new Date(safe));
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month") - 1,
    day: read("day"),
    // Some locales render midnight as hour 24; normalise it.
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

/** The zone's UTC offset in ms AT THIS INSTANT — not a constant for the zone. */
function offsetAt(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second) - ms;
}

/**
 * The instant at which the given wall-clock date is midnight in `timeZone`.
 *
 * Inverting a zone conversion needs a correction pass: the first guess uses the
 * offset in force at the guessed instant, which can be the wrong side of a DST
 * transition. Re-reading the offset at the corrected instant settles it.
 */
export function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string
): number {
  const wallClock = Date.UTC(year, month, day);
  const firstGuess = wallClock - offsetAt(wallClock, timeZone);
  const settled = wallClock - offsetAt(firstGuess, timeZone);

  // Some zones SKIP midnight on a DST change — America/Santiago springs forward
  // at 00:00, so no instant that day reads 00:00 and the correction lands on the
  // day BEFORE. Left alone that drops a whole day from every daily chart. Walk
  // forward to the first instant that really is on the requested day.
  const wanted = Date.UTC(year, month, day);
  const dayOf = (ms: number) => {
    const p = zonedParts(ms, timeZone);
    return Date.UTC(p.year, p.month, p.day);
  };

  // 15-minute steps because some zones shift by 30 or 45 minutes, and a bound of
  // a full day rather than a few hours: three hours covers every DST jump on
  // record, but exhausting the loop returned an instant on the WRONG day without
  // a word, and a chart quietly filed under the previous date is worse than the
  // handful of extra formatToParts calls this can never actually spend. The walk
  // exits the moment it reaches the day, which for every real zone is at most a
  // few steps and normally zero.
  const STEP_MS = 15 * 60_000;
  const MAX_STEPS = (26 * 60) / 15;

  let result = settled;
  let steps = 0;
  let walkedForward = false;

  // Runs past `wanted` only for a date that does not exist in this zone at all —
  // Pacific/Apia skipped 30 Dec 2011 outright, jumping from the 29th to the 31st.
  // Starting the window at the next real instant is the only available answer.
  while (steps < MAX_STEPS && dayOf(result) < wanted) {
    result += STEP_MS;
    steps += 1;
    walkedForward = true;
  }

  // Symmetric guard for a zone that moves its clocks BACK across midnight, which
  // can leave the correction pass a day ahead.
  //
  // Skipped when the forward walk moved, or the two fight: for a nonexistent
  // date the forward walk correctly lands on the NEXT day, and this would then
  // march it back to 23:45 on the day BEFORE — the wrong side of a date that has
  // no instants of its own, and a bucket keyed to the wrong day.
  if (!walkedForward) {
    while (steps < MAX_STEPS && dayOf(result) > wanted) {
      result -= STEP_MS;
      steps += 1;
    }
  }

  return result;
}

/** Midnight in `timeZone` on the calendar day containing `ms`, shifted by `dayDelta`. */
export function zonedStartOfDay(ms: number, timeZone: string, dayDelta = 0): number {
  const p = zonedParts(ms, timeZone);
  return zonedMidnight(p.year, p.month, p.day + dayDelta, timeZone);
}

/** Midnight in `timeZone` on the first of the month containing `ms`, shifted by months. */
export function zonedStartOfMonth(ms: number, timeZone: string, monthDelta = 0): number {
  const p = zonedParts(ms, timeZone);
  return zonedMidnight(p.year, p.month + monthDelta, 1, timeZone);
}

/** `YYYY-MM-DD` on the viewer's calendar. */
export function zonedDayKey(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** `YYYY-M` on the viewer's calendar. */
export function zonedMonthKey(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${p.month}`;
}
