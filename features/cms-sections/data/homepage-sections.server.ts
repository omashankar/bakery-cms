import { createDefaultHomepageSections } from "@/constants/section-registry";
import { createJsonStore } from "@/lib/server/json-store";
import { getVisibleSections, sortSections } from "@/features/cms-sections/lib/section-utils";
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

const store = createJsonStore<HomepageBuilderState>({
  file: "homepage-sections.json",
  seed: () => ({ draft: createSnapshot(), published: createSnapshot() }),
  isValid: (state) => Boolean(state?.draft?.sections && state?.published?.sections),
});

export async function getHomepageState(): Promise<HomepageBuilderState> {
  return store.read();
}

/** Published sections, ready to render: registry-ordered and visibility-filtered. */
export async function getPublishedHomepageSections(): Promise<HomepageSectionInstance[]> {
  const { published } = await store.read();
  // FAQs live only on the dedicated FAQ page — never render a home FAQ section,
  // even if an older saved snapshot still contains one.
  return getVisibleSections(sortSections(published.sections)).filter(
    (section) => section.type !== "faq"
  );
}

export async function getDraftHomepageSections(): Promise<HomepageSectionInstance[]> {
  const { draft } = await store.read();
  return getVisibleSections(sortSections(draft.sections)).filter(
    (section) => section.type !== "faq"
  );
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
      next: { draft: { ...snapshot }, published: snapshot },
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
