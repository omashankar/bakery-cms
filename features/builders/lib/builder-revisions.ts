/**
 * The shape of a stored builder revision.
 *
 * This file used to hold a localStorage revision log — read, push, restore,
 * capped at 8 — from when the page builders lived entirely in the editing
 * browser. Revisions moved to the builder's Mongo document (see
 * features/cms-sections/lib/builder-revision-utils.ts, capped at 20), and those
 * three functions were left behind with exactly one caller each: the localStorage
 * stores, which had themselves become unreachable. Both are gone; only the type
 * they all agreed on is real.
 *
 * It stays here rather than moving next to the server helpers because six modules
 * import it from this path and the type has not changed.
 */
export interface BuilderRevision<TSection> {
  id: string;
  label: string;
  savedAt: string;
  sections: TSection[];
}
