import type { BuilderRevision } from "@/features/builders/lib/builder-revisions";

/**
 * Server-side revision helpers for the homepage/wedding builder stores.
 *
 * Revisions are snapshots of the sections captured on every server publish and
 * kept inline on the builder's Mongo document (capped to the most recent
 * {@link MAX_REVISIONS}). These are pure, isomorphic functions — unlike the
 * localStorage helpers in `features/builders/lib/builder-revisions`, they never
 * touch `window`, so they are safe to run in the data layer.
 *
 * The returned shape is structurally identical to that module's
 * `BuilderRevision`, so the same `BuilderVersionHistoryPanel` renders both.
 */

export const MAX_REVISIONS = 20;

/** Prepend a fresh revision, deep-cloning the sections, capped to the last N. */
export function appendRevision<TSection>(
  existing: BuilderRevision<TSection>[] | undefined,
  sections: TSection[],
  label: string
): BuilderRevision<TSection>[] {
  const revision: BuilderRevision<TSection> = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    savedAt: new Date().toISOString(),
    // Detach from the live draft so later edits never mutate the snapshot.
    sections: JSON.parse(JSON.stringify(sections)) as TSection[],
  };
  return [revision, ...(existing ?? [])].slice(0, MAX_REVISIONS);
}

/** Find a stored revision by id and return a detached copy of its sections. */
export function findRevisionSections<TSection>(
  existing: BuilderRevision<TSection>[] | undefined,
  revisionId: string
): TSection[] | null {
  const revision = (existing ?? []).find((item) => item.id === revisionId);
  if (!revision) return null;
  return JSON.parse(JSON.stringify(revision.sections)) as TSection[];
}
