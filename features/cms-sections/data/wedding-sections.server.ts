import { createDefaultWeddingSections } from "@/constants/wedding-section-registry";
import { createJsonStore } from "@/lib/server/json-store";
import { getVisibleSections, sortSections } from "@/features/cms-sections/lib/section-utils";
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

const store = createJsonStore<WeddingBuilderState>({
  file: "wedding-sections.json",
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

export async function getWeddingState(): Promise<WeddingBuilderState> {
  return store.read();
}

export async function getPublishedWeddingSections(): Promise<WeddingSectionInstance[]> {
  return renderable((await store.read()).published.sections);
}

export async function getDraftWeddingSections(): Promise<WeddingSectionInstance[]> {
  return renderable((await store.read()).draft.sections);
}

export async function saveWeddingDraft(
  sections: WeddingSectionInstance[],
  scheduledPublishAt?: string | null
): Promise<WeddingBuilderSnapshot> {
  return store.mutate((state) => {
    const draft = createSnapshot(sections, scheduledPublishAt ?? undefined);
    return { next: { ...state, draft }, result: draft };
  });
}

export async function publishWeddingSections(
  sections: WeddingSectionInstance[]
): Promise<WeddingBuilderSnapshot> {
  return store.mutate(() => {
    const snapshot = createSnapshot(sections);
    return { next: { draft: { ...snapshot }, published: snapshot }, result: snapshot };
  });
}

export async function resetWeddingSections(): Promise<WeddingBuilderState> {
  return store.mutate(() => {
    const next = { draft: createSnapshot(), published: createSnapshot() };
    return { next, result: next };
  });
}

/** Test helper: drop the store so the next read re-seeds. */
export const resetWeddingStore = store.reset;
