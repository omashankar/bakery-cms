import { createDefaultHomepageSections } from "@/constants/section-registry";
import { createMongoStore } from "@/lib/server/db/cms-store";
import { getVisibleSections, sortSections } from "@/features/cms-sections/lib/section-utils";
import {
  appendRevision,
  findRevisionSections,
} from "@/features/cms-sections/lib/builder-revision-utils";
import type { BuilderRevision } from "@/features/builders/lib/builder-revisions";
import type {
  HomepageBuilderSnapshot,
  HomepageBuilderState,
  HomepageSectionInstance,
} from "@/types/homepage-builder";

/**
 * Server-side homepage section store.
 *
 * The storefront reads published sections here at render time, so the homepage
 * ships real content in its HTML. Previously sections lived only in the editing
 * browser's localStorage, which meant the server had nothing to render and the
 * page went out as an empty skeleton — invisible to crawlers and a blank first
 * paint for everyone.
 */

function nowIso(): string {
  return new Date().toISOString();
}

function createSnapshot(
  sections?: HomepageSectionInstance[],
  scheduledPublishAt?: string
): HomepageBuilderSnapshot {
  return {
    sections: sections ?? createDefaultHomepageSections(),
    updatedAt: nowIso(),
    scheduledPublishAt,
  };
}

/**
 * Stored state extends the public builder state with an inline revision log.
 * The extra field is optional and absent from freshly seeded/legacy documents,
 * so a store with no revisions serialises byte-for-byte as before.
 */
type HomepageStoreState = HomepageBuilderState & {
  revisions?: BuilderRevision<HomepageSectionInstance>[];
};

const store = createMongoStore<HomepageStoreState>({
  key: "homepage-sections",
  seed: () => ({ draft: createSnapshot(), published: createSnapshot() }),
  isValid: (state) => Boolean(state?.draft?.sections && state?.published?.sections),
});

function isScheduleDue(snapshot: HomepageBuilderSnapshot): boolean {
  const scheduled = snapshot.scheduledPublishAt;
  return Boolean(scheduled && new Date(scheduled).getTime() <= Date.now());
}

/**
 * Read the store, firing a due scheduled publish before returning (check-on-read
 * — there is no cron). When the draft's `scheduledPublishAt` has arrived we
 * promote draft -> published, clear the schedule, and log a revision. Idempotent
 * and a no-op when nothing is scheduled or the schedule is still in the future.
 */
async function readWithSchedule(): Promise<HomepageStoreState> {
  const state = await store.read();
  if (!isScheduleDue(state.draft)) return state;

  return store.mutate((current) => {
    // Re-check under the mutate lock so a concurrent read can't double-fire.
    if (!isScheduleDue(current.draft)) return { next: current, result: current };
    const snapshot = createSnapshot(current.draft.sections);
    const next: HomepageStoreState = {
      draft: { ...snapshot },
      published: snapshot,
      revisions: appendRevision(current.revisions, snapshot.sections, "Scheduled publish"),
    };
    return { next, result: next };
  });
}

export async function getHomepageState(): Promise<HomepageBuilderState> {
  return readWithSchedule();
}

/** Published sections, ready to render: registry-ordered and visibility-filtered. */
export async function getPublishedHomepageSections(): Promise<HomepageSectionInstance[]> {
  const { published } = await readWithSchedule();
  // FAQs live only on the dedicated FAQ page — never render a home FAQ section,
  // even if an older saved snapshot still contains one.
  return getVisibleSections(sortSections(published.sections)).filter(
    (section) => section.type !== "faq"
  );
}

export async function getDraftHomepageSections(): Promise<HomepageSectionInstance[]> {
  const { draft } = await readWithSchedule();
  return getVisibleSections(sortSections(draft.sections)).filter(
    (section) => section.type !== "faq"
  );
}

/** Newest-first publish revisions for the Version History panel. */
export async function listHomepageRevisions(): Promise<
  BuilderRevision<HomepageSectionInstance>[]
> {
  return (await readWithSchedule()).revisions ?? [];
}

/**
 * Load a stored revision's sections into the draft so the user can review and
 * publish. Leaves the published snapshot and revision log untouched; returns the
 * new draft snapshot, or null when the revision no longer exists.
 */
export async function restoreHomepageRevision(
  revisionId: string
): Promise<HomepageBuilderSnapshot | null> {
  return store.mutate((state) => {
    const sections = findRevisionSections(state.revisions, revisionId);
    if (!sections) return { next: state, result: null };
    const draft = createSnapshot(sections);
    return { next: { ...state, draft }, result: draft };
  });
}

export async function saveDraftSections(
  sections: HomepageSectionInstance[],
  scheduledPublishAt?: string | null
): Promise<HomepageBuilderSnapshot> {
  return store.mutate((state) => {
    const draft = createSnapshot(sections, scheduledPublishAt ?? undefined);
    return { next: { ...state, draft }, result: draft };
  });
}

export async function publishSections(
  sections: HomepageSectionInstance[]
): Promise<HomepageBuilderSnapshot> {
  return store.mutate((state) => {
    const snapshot = createSnapshot(sections);
    return {
      // Publishing clears any pending schedule — it has just happened.
      next: {
        draft: { ...snapshot },
        published: snapshot,
        revisions: appendRevision(state.revisions, snapshot.sections, "Homepage publish"),
      },
      result: snapshot,
    };
  });
}

export async function resetHomepageSections(): Promise<HomepageBuilderState> {
  return store.mutate(() => {
    const next = { draft: createSnapshot(), published: createSnapshot() };
    return { next, result: next };
  });
}

/** Test helper: drop the store so the next read re-seeds. */
export const resetHomepageStore = store.reset;
