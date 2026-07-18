import type {
  HomepageBuilderSnapshot,
  HomepageBuilderState,
  HomepageSectionInstance,
} from "@/types/homepage-builder";

/**
 * Browser-side homepage section access for the admin builder.
 *
 * The builder is a client app, so it talks to the API. The storefront renders
 * on the server and reads the store directly.
 */

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/homepage-sections", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export interface HomepagePublishMeta {
  draftUpdatedAt: string | null;
  publishedUpdatedAt: string | null;
  scheduledPublishAt: string | null;
  hasUnpublishedChanges: boolean;
  sectionCount: number;
  visibleCount: number;
}

/** Derives builder status from server state — no second round trip. */
export function deriveHomepageMeta(state: HomepageBuilderState): HomepagePublishMeta {
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

export async function fetchHomepageState(): Promise<HomepageBuilderState> {
  const { state } = await request<{ state: HomepageBuilderState }>();
  return state;
}

export async function saveHomepageDraft(
  sections: HomepageSectionInstance[],
  scheduledPublishAt?: string | null
): Promise<HomepageBuilderSnapshot> {
  const { snapshot } = await request<{ snapshot: HomepageBuilderSnapshot }>({
    method: "PUT",
    body: JSON.stringify({ sections, scheduledPublishAt }),
  });
  return snapshot;
}

export async function publishHomepage(
  sections: HomepageSectionInstance[]
): Promise<HomepageBuilderSnapshot> {
  const { snapshot } = await request<{ snapshot: HomepageBuilderSnapshot }>({
    method: "POST",
    body: JSON.stringify({ sections }),
  });
  return snapshot;
}

export async function resetHomepage(): Promise<HomepageBuilderState> {
  const { state } = await request<{ state: HomepageBuilderState }>({
    method: "POST",
    body: JSON.stringify({ action: "reset" }),
  });
  return state;
}
