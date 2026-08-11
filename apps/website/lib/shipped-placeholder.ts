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
export function chosen(value: string | undefined, placeholder: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed !== placeholder.trim() ? trimmed : "";
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
