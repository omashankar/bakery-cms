import type { BuilderRevision } from "@/features/builders/lib/builder-revisions";
import type {
  HomepageBuilderSnapshot,
  HomepageBuilderState,
  HomepageSectionInstance,
} from "@/types/homepage-builder";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

/**
 * Browser-side homepage section access for the admin builder.
 *
 * The builder is a client app, so it talks to the API. The storefront renders
 * on the server and reads the store directly.
 */

/**
 * A refused write, carrying what the server said about it.
 *
 * A 409 answers with the version the store is on now. Throwing a bare Error
 * discarded it, and the builder's version ref stayed pinned at the number the
 * conflict rejected — so every subsequent save in that tab conflicted too and
 * the admin could not save again at all, in a tab still holding their work.
 */
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
  const response = await fetch("/api/homepage-sections", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    noteAuthStatus(response.status);
    throw new BuilderRequestError(
      payload?.error ?? `Request failed (${response.status})`,
      response.status,
      typeof payload?.currentVersion === "number" ? payload.currentVersion : undefined,
    );
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

/**
 * A write's result, carrying the version to send with the next one.
 *
 * The builder is replace-all, so every write has to say which state it was
 * composed against — otherwise a stale tab silently replaces work it never saw.
 */
export interface HomepageWriteResult {
  snapshot: HomepageBuilderSnapshot;
  version: number;
}

export async function saveHomepageDraft(
  sections: HomepageSectionInstance[],
  scheduledPublishAt?: string | null,
  expectedVersion?: number
): Promise<HomepageWriteResult> {
  return request<HomepageWriteResult>({
    method: "PUT",
    body: JSON.stringify({ sections, scheduledPublishAt, expectedVersion }),
  });
}

export async function publishHomepage(
  sections: HomepageSectionInstance[],
  expectedVersion?: number
): Promise<HomepageWriteResult> {
  return request<HomepageWriteResult>({
    method: "POST",
    body: JSON.stringify({ sections, expectedVersion }),
  });
}

export async function resetHomepage(): Promise<HomepageBuilderState> {
  const { state } = await request<{ state: HomepageBuilderState }>({
    method: "POST",
    body: JSON.stringify({ action: "reset" }),
  });
  return state;
}

export type HomepageRevision = BuilderRevision<HomepageSectionInstance>;

async function revisionsRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/builders/homepage/revisions", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    noteAuthStatus(response.status);
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

/** Server-stored publish revisions, newest first. */
export async function fetchHomepageRevisions(): Promise<HomepageRevision[]> {
  const { revisions } = await revisionsRequest<{ revisions: HomepageRevision[] }>();
  return revisions;
}

/** Restore a revision's sections into the draft; returns the new draft snapshot. */
export async function restoreHomepageRevision(
  revisionId: string
): Promise<HomepageBuilderSnapshot> {
  const { snapshot } = await revisionsRequest<{ snapshot: HomepageBuilderSnapshot }>({
    method: "POST",
    body: JSON.stringify({ revisionId }),
  });
  return snapshot;
}
