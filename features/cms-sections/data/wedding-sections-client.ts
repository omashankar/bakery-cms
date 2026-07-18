import type {
  WeddingBuilderSnapshot,
  WeddingBuilderState,
  WeddingSectionInstance,
} from "@/types/wedding-builder";

/** Browser-side wedding section access for the admin builder. */

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/wedding-sections", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export interface WeddingPublishMeta {
  draftUpdatedAt: string | null;
  publishedUpdatedAt: string | null;
  scheduledPublishAt: string | null;
  hasUnpublishedChanges: boolean;
  sectionCount: number;
  visibleCount: number;
}

/** Derives builder status from server state — no second round trip. */
export function deriveWeddingMeta(state: WeddingBuilderState): WeddingPublishMeta {
  const draft = state.draft.sections ?? [];
  return {
    draftUpdatedAt: state.draft.updatedAt ?? null,
    publishedUpdatedAt: state.published.updatedAt ?? null,
    scheduledPublishAt: state.draft.scheduledPublishAt ?? null,
    hasUnpublishedChanges:
      JSON.stringify(draft) !== JSON.stringify(state.published.sections ?? []),
    sectionCount: draft.length,
    visibleCount: draft.filter((section) => section.isVisible !== false).length,
  };
}

export async function fetchWeddingState(): Promise<WeddingBuilderState> {
  const { state } = await request<{ state: WeddingBuilderState }>();
  return state;
}

export async function saveWeddingDraftRequest(
  sections: WeddingSectionInstance[],
  scheduledPublishAt?: string | null
): Promise<WeddingBuilderSnapshot> {
  const { snapshot } = await request<{ snapshot: WeddingBuilderSnapshot }>({
    method: "PUT",
    body: JSON.stringify({ sections, scheduledPublishAt }),
  });
  return snapshot;
}

export async function publishWedding(
  sections: WeddingSectionInstance[]
): Promise<WeddingBuilderSnapshot> {
  const { snapshot } = await request<{ snapshot: WeddingBuilderSnapshot }>({
    method: "POST",
    body: JSON.stringify({ sections }),
  });
  return snapshot;
}

export async function resetWedding(): Promise<WeddingBuilderState> {
  const { state } = await request<{ state: WeddingBuilderState }>({
    method: "POST",
    body: JSON.stringify({ action: "reset" }),
  });
  return state;
}
