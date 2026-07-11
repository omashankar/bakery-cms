export interface BuilderRevision<TSection> {
  id: string;
  label: string;
  savedAt: string;
  sections: TSection[];
}

const MAX_REVISIONS = 8;

function readRevisions<TSection>(storageKey: string): BuilderRevision<TSection>[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BuilderRevision<TSection>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRevisions<TSection>(
  storageKey: string,
  revisions: BuilderRevision<TSection>[]
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(revisions.slice(0, MAX_REVISIONS)));
}

export function listBuilderRevisions<TSection>(storageKey: string): BuilderRevision<TSection>[] {
  return readRevisions<TSection>(storageKey);
}

export function pushBuilderRevision<TSection>(
  storageKey: string,
  sections: TSection[],
  label?: string
): BuilderRevision<TSection>[] {
  const revision: BuilderRevision<TSection> = {
    id: `rev-${Date.now()}`,
    label: label ?? `Published ${new Date().toLocaleString()}`,
    savedAt: new Date().toISOString(),
    sections: JSON.parse(JSON.stringify(sections)) as TSection[],
  };

  const next = [revision, ...readRevisions<TSection>(storageKey)].slice(0, MAX_REVISIONS);
  writeRevisions(storageKey, next);
  return next;
}

export function restoreBuilderRevision<TSection>(
  storageKey: string,
  revisionId: string
): TSection[] | null {
  const revision = readRevisions<TSection>(storageKey).find((item) => item.id === revisionId);
  if (!revision) return null;
  return JSON.parse(JSON.stringify(revision.sections)) as TSection[];
}
