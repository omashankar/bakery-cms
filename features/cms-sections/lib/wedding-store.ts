import { createDefaultWeddingSections } from "@/constants/wedding-section-registry";
import { pushBuilderRevision } from "@/features/admin/builders/shared/builder-revisions";
import type {
  WeddingBuilderSnapshot,
  WeddingBuilderState,
  WeddingSectionInstance,
} from "@/types/wedding-builder";
import { getVisibleSections, sortSections } from "./section-utils";

const DRAFT_KEY = "bakery-cms-wedding-draft";
const PUBLISHED_KEY = "bakery-cms-wedding-published";
const REVISIONS_KEY = "bakery-cms-wedding-revisions";
const WEDDING_VERSION_KEY = "bakery-cms-wedding-version";
const WEDDING_VERSION = 3;

function mergeSectionsWithRegistry(
  sections: WeddingSectionInstance[]
): WeddingSectionInstance[] {
  const existingTypes = new Set(sections.map((section) => section.type));
  const defaults = createDefaultWeddingSections();
  const missing = defaults.filter((section) => !existingTypes.has(section.type));

  if (missing.length === 0) {
    return sortSections(sections);
  }

  const maxOrder = Math.max(...sections.map((section) => section.order), -1);

  return sortSections([
    ...sections,
    ...missing.map((section, index) => ({
      ...section,
      instanceId: `${section.type}-merged-${index}`,
      order: maxOrder + 1 + index,
    })),
  ]);
}

function normalizeSnapshot(snapshot: WeddingBuilderSnapshot): WeddingBuilderSnapshot {
  return {
    ...snapshot,
    sections: mergeSectionsWithRegistry(snapshot.sections),
  };
}

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

function readSnapshot(key: string): WeddingBuilderSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WeddingBuilderSnapshot;
    const storedVersion = Number(localStorage.getItem(WEDDING_VERSION_KEY) ?? 1);
    if (storedVersion < WEDDING_VERSION) {
      const normalized = normalizeSnapshot(parsed);
      writeSnapshot(key, normalized);
      localStorage.setItem(WEDDING_VERSION_KEY, String(WEDDING_VERSION));
      return normalized;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(key: string, snapshot: WeddingBuilderSnapshot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(snapshot));
}

export function getWeddingBuilderState(): WeddingBuilderState {
  const draft = readSnapshot(DRAFT_KEY) ?? createSnapshot();
  const published = readSnapshot(PUBLISHED_KEY) ?? createSnapshot();
  return { draft, published };
}

export function getDraftWeddingSections(): WeddingSectionInstance[] {
  return sortSections(readSnapshot(DRAFT_KEY)?.sections ?? createDefaultWeddingSections());
}

export function getPublishedWeddingSections(): WeddingSectionInstance[] {
  return sortSections(
    readSnapshot(PUBLISHED_KEY)?.sections ?? createDefaultWeddingSections()
  );
}

export function saveDraftWeddingSections(
  sections: WeddingSectionInstance[],
  scheduledPublishAt?: string | null
): WeddingBuilderSnapshot {
  const existing = readSnapshot(DRAFT_KEY);
  const snapshot = createSnapshot(
    sortSections(sections),
    scheduledPublishAt === null
      ? undefined
      : scheduledPublishAt ?? existing?.scheduledPublishAt
  );
  writeSnapshot(DRAFT_KEY, snapshot);
  return snapshot;
}

export function publishWeddingSections(
  sections: WeddingSectionInstance[]
): WeddingBuilderSnapshot {
  const sorted = sortSections(sections);
  const snapshot = createSnapshot(sorted);
  writeSnapshot(DRAFT_KEY, snapshot);
  writeSnapshot(PUBLISHED_KEY, snapshot);
  pushBuilderRevision(REVISIONS_KEY, sorted, `Wedding publish ${new Date().toLocaleString()}`);
  return snapshot;
}

export function scheduleWeddingPublish(
  sections: WeddingSectionInstance[],
  scheduledPublishAt: string
): WeddingBuilderSnapshot {
  return saveDraftWeddingSections(sections, scheduledPublishAt);
}

export function processScheduledWeddingPublish(): boolean {
  const draft = readSnapshot(DRAFT_KEY);
  if (!draft?.scheduledPublishAt) return false;
  if (new Date(draft.scheduledPublishAt).getTime() > Date.now()) return false;
  publishWeddingSections(draft.sections);
  return true;
}

export function hasUnpublishedWeddingChanges(): boolean {
  const draft = readSnapshot(DRAFT_KEY);
  const published = readSnapshot(PUBLISHED_KEY);
  if (!draft || !published) return false;
  return JSON.stringify(draft.sections) !== JSON.stringify(published.sections);
}

export function resetWeddingToDefaults(): WeddingBuilderState {
  const snapshot = createSnapshot();
  writeSnapshot(DRAFT_KEY, snapshot);
  writeSnapshot(PUBLISHED_KEY, snapshot);
  if (typeof window !== "undefined") {
    localStorage.setItem(WEDDING_VERSION_KEY, String(WEDDING_VERSION));
  }
  return { draft: snapshot, published: snapshot };
}

export function getWeddingPublishMeta(): {
  draftUpdatedAt: string | null;
  publishedUpdatedAt: string | null;
  scheduledPublishAt: string | null;
  hasUnpublishedChanges: boolean;
  sectionCount: number;
  visibleCount: number;
} {
  const draft = readSnapshot(DRAFT_KEY);
  const published = readSnapshot(PUBLISHED_KEY);
  const sections = draft?.sections ?? [];
  return {
    draftUpdatedAt: draft?.updatedAt ?? null,
    publishedUpdatedAt: published?.updatedAt ?? null,
    scheduledPublishAt: draft?.scheduledPublishAt ?? null,
    hasUnpublishedChanges: hasUnpublishedWeddingChanges(),
    sectionCount: sections.length,
    visibleCount: sections.filter((section) => section.isVisible).length,
  };
}

export { REVISIONS_KEY as WEDDING_REVISIONS_KEY };

export { getVisibleSections, sortSections };
