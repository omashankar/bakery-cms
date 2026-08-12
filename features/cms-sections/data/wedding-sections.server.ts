import { createDefaultWeddingSections } from "@/constants/wedding-section-registry";
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
  WeddingBuilderSnapshot,
  WeddingBuilderState,
  WeddingSectionInstance,
} from "@/types/wedding-builder";

/**
 * Server-side wedding section store — the same shape as the homepage store.
 *
 * See homepage-sections.server.ts for why these moved off localStorage.
 */

function nowIso(): string {
  return new Date().toISOString();
}

function createSnapshot(
  sections?: WeddingSectionInstance[],
  scheduledPublishAt?: string
): WeddingBuilderSnapshot {
  return {
    sections: sections ?? createDefaultWeddingSections(),
    updatedAt: nowIso(),
    scheduledPublishAt,
  };
}

/**
 * Stored state extends the public builder state with an inline revision log.
 * The extra field is optional and absent from freshly seeded/legacy documents,
 * so a store with no revisions serialises byte-for-byte as before.
 */
type WeddingStoreState = WeddingBuilderState & {
  revisions?: BuilderRevision<WeddingSectionInstance>[];
};

const store = createMongoStore<WeddingStoreState>({
  key: "wedding-sections",
  seed: () => ({ draft: createSnapshot(), published: createSnapshot() }),
  isValid: (state) => Boolean(state?.draft?.sections && state?.published?.sections),
});

function renderable(sections: WeddingSectionInstance[]): WeddingSectionInstance[] {
  // FAQs live only on the dedicated FAQ page — never render a wedding FAQ
  // section here, even if an older saved snapshot still contains one.
  return getVisibleSections(sortSections(sections)).filter(
    (section) => section.type !== "wedding-faq"
  );
}

function isScheduleDue(snapshot: WeddingBuilderSnapshot): boolean {
  const scheduled = snapshot.scheduledPublishAt;
  return Boolean(scheduled && new Date(scheduled).getTime() <= Date.now());
}

/**
 * Read the store, firing a due scheduled publish before returning (check-on-read
 * — there is no cron). When the draft's `scheduledPublishAt` has arrived we
 * promote draft -> published, clear the schedule, and log a revision. Idempotent
 * and a no-op when nothing is scheduled or the schedule is still in the future.
 */
async function readWithSchedule(): Promise<WeddingStoreState> {
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
    const next: WeddingStoreState = {
      draft: { ...snapshot },
      published: snapshot,
      revisions: appendRevision(current.revisions, snapshot.sections, "Scheduled publish"),
      version: nextVersion(current),
    };
    return { next, result: next };
  });
}

export async function getWeddingState(): Promise<WeddingBuilderState> {
  return readWithSchedule();
}

export async function getPublishedWeddingSections(): Promise<WeddingSectionInstance[]> {
  return renderable((await readWithSchedule()).published.sections);
}

export async function getDraftWeddingSections(): Promise<WeddingSectionInstance[]> {
  return renderable((await readWithSchedule()).draft.sections);
}

/** Newest-first publish revisions for the Version History panel. */
export async function listWeddingRevisions(): Promise<
  BuilderRevision<WeddingSectionInstance>[]
> {
  return (await readWithSchedule()).revisions ?? [];
}

/**
 * Load a stored revision's sections into the draft so the user can review and
 * publish. Leaves the published snapshot and revision log untouched; returns the
 * new draft snapshot, or null when the revision no longer exists.
 */
export async function restoreWeddingRevision(
  revisionId: string
): Promise<WeddingBuilderSnapshot | null> {
  return store.mutate((state) => {
    const sections = findRevisionSections(state.revisions, revisionId);
    if (!sections) return { next: state, result: null };
    // Sorted, and the pending schedule carried over — see the homepage store for
    // why each matters.
    const draft = createSnapshot(sortSections(sections), state.draft.scheduledPublishAt);
    return {
      next: { ...state, draft, version: nextVersion(state) },
      result: draft,
    };
  });
}

/** `expectedVersion` is what the builder read on load — see the homepage store. */
export async function saveWeddingDraft(
  sections: WeddingSectionInstance[],
  scheduledPublishAt?: string | null,
  expectedVersion?: number
): Promise<VersionedSnapshot<WeddingBuilderSnapshot>> {
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

export async function publishWeddingSections(
  sections: WeddingSectionInstance[],
  expectedVersion?: number
): Promise<VersionedSnapshot<WeddingBuilderSnapshot>> {
  return store.mutate((state) => {
    assertVersion(state, expectedVersion);
    const snapshot = createSnapshot(sections);
    const version = nextVersion(state);
    return {
      next: {
        draft: { ...snapshot },
        published: snapshot,
        revisions: appendRevision(state.revisions, snapshot.sections, "Wedding publish"),
        version,
      },
      result: { snapshot, version },
    };
  });
}

/**
 * Back to the registry defaults, keeping the revision log and capturing the
 * layout that was live so the reset can be undone — see the homepage store for
 * the full account of what this used to destroy.
 */
export async function resetWeddingSections(): Promise<WeddingBuilderState> {
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
export const resetWeddingStore = store.reset;
