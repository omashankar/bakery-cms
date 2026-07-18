import type { GlobalSearchResult } from "./global-search";

const STORAGE_KEY = "bakery-cms-global-search-recent";
const MAX_RECENT = 8;

export interface RecentSearchEntry {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  group: GlobalSearchResult["group"];
  visitedAt: string;
}

export function loadRecentSearches(): RecentSearchEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearchEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentSearch(result: GlobalSearchResult): void {
  if (typeof window === "undefined") return;

  const entry: RecentSearchEntry = {
    id: result.id,
    title: result.title,
    subtitle: result.subtitle,
    href: result.href,
    group: result.group,
    visitedAt: new Date().toISOString(),
  };

  const next = [
    entry,
    ...loadRecentSearches().filter((item) => item.id !== result.id),
  ].slice(0, MAX_RECENT);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function recentSearchToResult(entry: RecentSearchEntry): GlobalSearchResult {
  return {
    id: entry.id,
    group: entry.group,
    title: entry.title,
    subtitle: entry.subtitle,
    href: entry.href,
  };
}
