/**
 * Converting between a stored instant and the builder's schedule field.
 *
 * `<input type="datetime-local">` has no timezone: its value is wall-clock text
 * that the browser reads in the viewer's LOCAL zone. The store holds a UTC
 * instant. Those are two different things, and the builder used to convert one
 * way and not the other:
 *
 *   set 10 Aug 09:00 in Mumbai  ->  saved "2026-08-10T03:30:00.000Z"   (correct)
 *   read back with .toISOString().slice(0,16)  ->  "2026-08-10T03:30"
 *   the input reads that as LOCAL                ->  field flips to 03:30
 *   next "Save draft" re-encodes it as local     ->  "2026-08-09T22:00:00.000Z"
 *
 * So the field visibly jumped by the UTC offset the moment it was saved, and
 * every subsequent save moved the real go-live another 5h30m earlier — a
 * homepage scheduled for 9am publishing at half three in the morning, then
 * earlier again. Only shops on UTC were unaffected, which is why it survived.
 *
 * These two functions are exact inverses to the minute, in any zone.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** A stored UTC instant as the local wall-clock text the input expects. */
export function toScheduleInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** The input's local wall-clock text as the UTC instant to store. */
export function fromScheduleInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
