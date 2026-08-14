import type { BuilderRevision } from "@/features/builders/lib/builder-revisions";
import type {
  WeddingBuilderSnapshot,
  WeddingBuilderState,
  WeddingSectionInstance,
} from "@/types/wedding-builder";

/** Browser-side wedding section access for the admin builder. */

/** A refused write, carrying the server's current version — see the homepage client. */
export class BuilderRequestError extends Error {
  readonly status: number;
  readonly currentVersion?: number;

  constructor(message: string, status: number, currentVersion?: number) {
    super(message);
    this.name = "BuilderRequestError";
    this.status = status;
    this.currentVersion = currentVersion;
  }
}

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/wedding-sections", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new BuilderRequestError(
      payload?.error ?? `Request failed (${response.status})`,
      response.status,
      typeof payload?.currentVersion === "number" ? payload.currentVersion : undefined,
    );
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

/** A write's result, carrying the version to send with the next one. */
export interface WeddingWriteResult {
  snapshot: WeddingBuilderSnapshot;
  version: number;
}

export async function saveWeddingDraftRequest(
  sections: WeddingSectionInstance[],
  scheduledPublishAt?: string | null,
  expectedVersion?: number
): Promise<WeddingWriteResult> {
  return request<WeddingWriteResult>({
    method: "PUT",
    body: JSON.stringify({ sections, scheduledPublishAt, expectedVersion }),
  });
}

export async function publishWedding(
  sections: WeddingSectionInstance[],
  expectedVersion?: number
): Promise<WeddingWriteResult> {
  return request<WeddingWriteResult>({
    method: "POST",
    body: JSON.stringify({ sections, expectedVersion }),
  });
}

export async function resetWedding(): Promise<WeddingBuilderState> {
  const { state } = await request<{ state: WeddingBuilderState }>({
    method: "POST",
    body: JSON.stringify({ action: "reset" }),
  });
  return state;
}

export type WeddingRevision = BuilderRevision<WeddingSectionInstance>;

async function revisionsRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/builders/wedding/revisions", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

/** Server-stored publish revisions, newest first. */
export async function fetchWeddingRevisions(): Promise<WeddingRevision[]> {
  const { revisions } = await revisionsRequest<{ revisions: WeddingRevision[] }>();
  return revisions;
}

/** Restore a revision's sections into the draft; returns the new draft snapshot. */
export async function restoreWeddingRevision(
  revisionId: string
): Promise<WeddingBuilderSnapshot> {
  const { snapshot } = await revisionsRequest<{ snapshot: WeddingBuilderSnapshot }>({
    method: "POST",
    body: JSON.stringify({ revisionId }),
  });
  return snapshot;
}
