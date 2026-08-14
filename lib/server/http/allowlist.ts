/**
 * Look a caller-supplied key up in a literal map, WITHOUT reaching the
 * prototype chain.
 *
 * Every one of this codebase's `[section]` / `[key]` endpoints is guarded the
 * same way: index a map of known sections, and 404 when the lookup comes back
 * falsy. A bare index does not come back falsy for `constructor`, `toString`,
 * `valueOf`, `hasOwnProperty` or `__proto__` — those resolve off
 * `Object.prototype` — so all of them walked straight past the guard. What
 * happened next depended on what the map held:
 *
 *   - a map of Zod schemas handed `Object.prototype` to `validate()`, which
 *     called `.safeParse` on something that does not have it: a masked 500
 *     where the answer was 404. On `/api/site-layout/[key]` and
 *     `/api/content/[key]` — both PUBLIC reads — an anonymous request did that.
 *   - a map of stores handed back `Function.prototype.toString` and called
 *     `.read()` on it.
 *   - a map of DEFAULTS, on the reset endpoints, was worse: nothing threw at
 *     all. Mongoose's strict schema silently dropped the write, the route
 *     answered 200 "reset", and an audit row went into the trail the Security
 *     Center reads — a record of something that never happened, for a section
 *     that does not exist.
 *
 * Ten sites across five features had the same shape, and fixing them one at a
 * time is how the settings one got repaired while its catalog twin did not. One
 * helper, so there is nothing left to restate.
 */
export function allowlisted<T extends object>(map: T, key: string): T[keyof T] | undefined {
  return Object.hasOwn(map, key) ? map[key as keyof T] : undefined;
}
