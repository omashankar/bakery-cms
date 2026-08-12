import { createDefaultHomepageSections } from "@/constants/section-registry";
import { createMongoStore } from "@/lib/server/db/cms-store";
import { getVisibleSections, sortSections } from "@/features/cms-sections/lib/section-utils";
import {
  appendRevision,
  findRevisionSections,
} from "@/features/cms-sections/lib/builder-revision-utils";
import {
  assertVersion,
  nextVersion,
  versionOf,
  type VersionedSnapshot,
} from "@/features/cms-sections/lib/builder-conflict";
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
  // Always REPORTS a version, even for a document written before versioning
  // existed. A reader that answers `undefined` forces every caller to write
  // `?? 0` and turns a forgotten one into a versionless — now refused — write.
  const versioned = { ...state, version: versionOf(state) };
  if (!isScheduleDue(versioned.draft)) return versioned;

  return store.mutate((current) => {
    // Re-check under the mutate lock so a concurrent read can't double-fire.
    if (!isScheduleDue(current.draft)) return { next: current, result: current };
    const snapshot = createSnapshot(current.draft.sections);
    const next: HomepageStoreState = {
      draft: { ...snapshot },
      published: snapshot,
      revisions: appendRevision(current.revisions, snapshot.sections, "Scheduled publish"),
      version: nextVersion(current),
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
    const draft = createSnapshot(
      // Sorted here so the builder's own sortSections on the response is a no-op
      // and what it shows is byte-identical to what is stored. Otherwise it sits
      // flagged clean while holding different `order` values.
      sortSections(sections),
      // Carried over. A restore rebuilt the draft with no second argument, so
      // opening History on Friday to compare against last month's layout erased
      // the Monday 09:00 launch the admin had already scheduled — silently, and
      // Monday came and went with nothing published.
      state.draft.scheduledPublishAt
    );
    return {
      next: { ...state, draft, version: nextVersion(state) },
      result: draft,
    };
  });
}

/**
 * Save the draft.
 *
 * `expectedVersion` is what the builder read when it loaded. Without it this is
 * replace-all with nothing to compare against: a tab open since 09:00 and saved
 * at 09:15 quietly replaced everything done in between, and both admins got a
 * green "draft saved".
 */
export async function saveDraftSections(
  sections: HomepageSectionInstance[],
  scheduledPublishAt?: string | null,
  expectedVersion?: number
): Promise<VersionedSnapshot<HomepageBuilderSnapshot>> {
  return store.mutate((state) => {
    assertVersion(state, expectedVersion);
    const draft = createSnapshot(sections, scheduledPublishAt ?? undefined);
    const version = nextVersion(state);
    return {
      next: { ...state, draft, version },
      result: { snapshot: draft, version },
    };
  });
}

export async function publishSections(
  sections: HomepageSectionInstance[],
  expectedVersion?: number
): Promise<VersionedSnapshot<HomepageBuilderSnapshot>> {
  return store.mutate((state) => {
    // Checked here above all: publishing a stale array puts the storefront back
    // in time for every visitor AND destroys the other admin's saved draft in
    // the same write.
    assertVersion(state, expectedVersion);
    const snapshot = createSnapshot(sections);
    const version = nextVersion(state);
    return {
      // Publishing clears any pending schedule — it has just happened.
      next: {
        draft: { ...snapshot },
        published: snapshot,
        revisions: appendRevision(state.revisions, snapshot.sections, "Homepage publish"),
        version,
      },
      result: { snapshot, version },
    };
  });
}

/**
 * Back to the registry defaults.
 *
 * The mutator used to ignore its `state` and return `{ draft, published }` only.
 * `createMongoStore.mutate` writes with `$set: { data: value }`, replacing the
 * whole document — so every publish snapshot the shop had ever taken went with
 * it, and an admin who reset intending to restore last month's layout from
 * Version History afterwards found it empty. Reset was the one action in the
 * builder that destroyed data no amount of re-doing the work could bring back.
 *
 * The history is kept, and the layout that was live is captured into it first,
 * so Reset is now recoverable in one click.
 */
export async function resetHomepageSections(): Promise<HomepageBuilderState> {
  return store.mutate((state) => {
    const draft = createSnapshot();
    const published = createSnapshot();
    const version = nextVersion(state);
    return {
      next: {
        draft,
        published,
        revisions: appendRevision(
          state.revisions,
          state.published.sections,
          "Before reset to defaults"
        ),
        version,
      },
      result: { draft, published, version },
    };
  });
}

/** Test helper: drop the store so the next read re-seeds. */
export const resetHomepageStore = store.reset;
