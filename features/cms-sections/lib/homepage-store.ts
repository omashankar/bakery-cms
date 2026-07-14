import { createDefaultHomepageSections } from "@/constants/section-registry";
import { pushBuilderRevision } from "@/features/admin/builders/shared/builder-revisions";
import type {
  HomepageBuilderSnapshot,
  HomepageBuilderState,
  HomepageSectionInstance,
} from "@/types/homepage-builder";
import { getVisibleSections, sortSections } from "./section-utils";

const DRAFT_KEY = "bakery-cms-homepage-draft";
const PUBLISHED_KEY = "bakery-cms-homepage-published";
const REVISIONS_KEY = "bakery-cms-homepage-revisions";
const HOMEPAGE_VERSION_KEY = "bakery-cms-homepage-version";
const HOMEPAGE_VERSION = 6;

function mergeSectionsWithRegistry(
  sections: HomepageSectionInstance[]
): HomepageSectionInstance[] {
  const defaults = createDefaultHomepageSections();
  const registryTypes = new Set(defaults.map((section) => section.type));
  // Drop persisted sections whose type was removed from the registry (e.g. FAQ,
  // which now lives only on the dedicated FAQ page).
  sections = sections.filter((section) => registryTypes.has(section.type));

  const existingTypes = new Set(sections.map((section) => section.type));
  const missing = defaults.filter((section) => !existingTypes.has(section.type));

  if (missing.length === 0) {
    return sortSections(sections);
  }

  // Registry order lets us slot new sections beside their neighbours (not just at the end).
  const registryIndex = new Map(defaults.map((section, index) => [section.type, index]));
  const result = [...sortSections(sections)];

  missing.forEach((section, index) => {
    const target = registryIndex.get(section.type) ?? result.length;
    let insertAt = 0;
    for (let i = 0; i < result.length; i += 1) {
      const currentIndex = registryIndex.get(result[i].type);
      if (currentIndex !== undefined && currentIndex < target) insertAt = i + 1;
    }
    result.splice(insertAt, 0, {
      ...section,
      instanceId: `${section.type}-merged-${index}`,
      order: 0,
    });
  });

  return sortSections(result.map((section, index) => ({ ...section, order: index })));
}

function normalizeSnapshot(snapshot: HomepageBuilderSnapshot): HomepageBuilderSnapshot {
  return {
    ...snapshot,
    sections: mergeSectionsWithRegistry(snapshot.sections),
  };
}

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

function readSnapshot(key: string): HomepageBuilderSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HomepageBuilderSnapshot;
    // Per-key version so draft AND published each migrate (a shared key let the
    // second read skip migration once the first bumped it).
    const versionKey = `${key}-version`;
    const storedVersion = Number(
      localStorage.getItem(versionKey) ??
        localStorage.getItem(HOMEPAGE_VERSION_KEY) ??
        1
    );
    if (storedVersion < HOMEPAGE_VERSION) {
      const normalized = normalizeSnapshot(parsed);
      writeSnapshot(key, normalized);
      localStorage.setItem(versionKey, String(HOMEPAGE_VERSION));
      localStorage.setItem(HOMEPAGE_VERSION_KEY, String(HOMEPAGE_VERSION));
      return normalized;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(key: string, snapshot: HomepageBuilderSnapshot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(snapshot));
}

export function getHomepageBuilderState(): HomepageBuilderState {
  const draft = readSnapshot(DRAFT_KEY) ?? createSnapshot();
  const published = readSnapshot(PUBLISHED_KEY) ?? createSnapshot();
  return { draft, published };
}

export function getDraftHomepageSections(): HomepageSectionInstance[] {
  return sortSections(readSnapshot(DRAFT_KEY)?.sections ?? createDefaultHomepageSections());
}

export function getPublishedHomepageSections(): HomepageSectionInstance[] {
  return sortSections(
    readSnapshot(PUBLISHED_KEY)?.sections ?? createDefaultHomepageSections()
  );
}

export function saveDraftHomepageSections(
  sections: HomepageSectionInstance[],
  scheduledPublishAt?: string | null
): HomepageBuilderSnapshot {
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

export function publishHomepageSections(sections: HomepageSectionInstance[]): HomepageBuilderSnapshot {
  const sorted = sortSections(sections);
  const snapshot = createSnapshot(sorted);
  writeSnapshot(DRAFT_KEY, snapshot);
  writeSnapshot(PUBLISHED_KEY, snapshot);
  pushBuilderRevision(REVISIONS_KEY, sorted, `Homepage publish ${new Date().toLocaleString()}`);
  return snapshot;
}

export function scheduleHomepagePublish(
  sections: HomepageSectionInstance[],
  scheduledPublishAt: string
): HomepageBuilderSnapshot {
  return saveDraftHomepageSections(sections, scheduledPublishAt);
}

export function processScheduledHomepagePublish(): boolean {
  const draft = readSnapshot(DRAFT_KEY);
  if (!draft?.scheduledPublishAt) return false;
  if (new Date(draft.scheduledPublishAt).getTime() > Date.now()) return false;
  publishHomepageSections(draft.sections);
  return true;
}

export function hasUnpublishedHomepageChanges(): boolean {
  const draft = readSnapshot(DRAFT_KEY);
  const published = readSnapshot(PUBLISHED_KEY);
  if (!draft || !published) return false;
  return JSON.stringify(draft.sections) !== JSON.stringify(published.sections);
}

export function resetHomepageToDefaults(): HomepageBuilderState {
  const snapshot = createSnapshot();
  writeSnapshot(DRAFT_KEY, snapshot);
  writeSnapshot(PUBLISHED_KEY, snapshot);
  if (typeof window !== "undefined") {
    localStorage.setItem(HOMEPAGE_VERSION_KEY, String(HOMEPAGE_VERSION));
  }
  return { draft: snapshot, published: snapshot };
}

export function getHomepagePublishMeta(): {
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
    hasUnpublishedChanges: hasUnpublishedHomepageChanges(),
    sectionCount: sections.length,
    visibleCount: sections.filter((section) => section.isVisible).length,
  };
}

export { REVISIONS_KEY as HOMEPAGE_REVISIONS_KEY };

export { getVisibleSections, sortSections };
