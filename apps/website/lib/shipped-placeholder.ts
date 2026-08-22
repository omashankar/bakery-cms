/**
 * Telling a value the admin CHOSE from one the install shipped with.
 *
 * Settings → Contact is never empty: the settings singleton is CREATED with
 * `defaultContactSettings`, which is `contactInfo` from landing-data — "123
 * Baker Street, Mumbai, Maharashtra 400001", a demo 1800 number, a demo
 * address. So an "is it filled in?" check can never fail, and a bakery in Delhi
 * that installs this CMS and never opens Settings publishes an address in
 * Mumbai. Worse, a `value || default` read turns a field the admin
 * deliberately CLEARED back into that same placeholder — the storefront then
 * prints a phone number nobody can answer, as a live `tel:` link.
 *
 * Two rules, and they are the same rule: a blank field means "we do not publish
 * this", and a value still equal to the shipped placeholder was seeded rather
 * than chosen. Both answer `""`, and the render site decides whether to show a
 * row at all.
 *
 * This lived privately inside `storefront-location.server.ts`, which is why the
 * contact page and the site footer beside it were still doing
 * `contact.phone || defaultContact.phone`.
 */
/**
 * Contact values this install used to ship, kept so they can still be REJECTED.
 *
 * These are not seeds and must never be rendered — `contactInfo` is blank now.
 * They are here because blanking the seed also deleted the thing `chosen()`
 * compared against: with the placeholder empty, the check below collapses to a
 * truthiness test, and any shop whose settings still hold these un-edited
 * values — the exact population the rule exists to protect — would start
 * publishing them, the phone as a live `tel:` in every footer.
 *
 * The email that shipped alongside these is deliberately absent: it is a real,
 * reachable address belonging to this install's owner, so suppressing it would
 * be the bug rather than the fix.
 *
 * Delete an entry once no install can still be holding it.
 */
const LEGACY_SEEDED_CONTACT = [
  "123 Baker Street, Mumbai, Maharashtra 400001",
  "+91 1800-123-4567",
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.626326424726!2d72.8776559!3d19.0759837!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c6306644edc1%3A0x5da4ed8f8d648c69!2sMumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin",
].map((entry) => entry.trim());

export function chosen(value: string | undefined, placeholder: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed === placeholder.trim()) return "";
  if (LEGACY_SEEDED_CONTACT.includes(trimmed)) return "";
  return trimmed;
}

/**
 * The same rule for a LIST — opening hours.
 *
 * `contact.businessHours?.length ? contact.businessHours : defaultHours` was
 * the read at all three sites, so a shop with no hours stored had "Monday –
 * Saturday, 9:00 AM – 9:00 PM" published under "Opening Hours" as its own. A
 * customer can act on that: turn up at 8pm to a shut door. Nobody at the bakery
 * ever typed it.
 *
 * And a list still identical to the shipped one was seeded, not chosen — the
 * settings singleton is CREATED with `defaultContactSettings`, so "is it
 * filled in?" can never fail. Same reasoning as `chosen` above, same answer:
 * empty, and the render site decides whether to show the section at all.
 */
export function chosenList<T>(
  value: T[] | undefined,
  placeholder: T[],
  identity: (item: T) => string,
): T[] {
  if (!value?.length) return [];

  const untouched =
    value.length === placeholder.length &&
    value.every((item, index) => identity(item) === identity(placeholder[index]!));

  return untouched ? [] : value;
}

/** How two opening-hours rows are compared for "is this still the shipped one". */
export function hoursIdentity(row: { day: string; hours: string }): string {
  return `${row.day.trim()}|${row.hours.trim()}`;
}
