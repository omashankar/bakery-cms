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

/**
 * A stored row, re-titled from the LIVE wording where there is one.
 *
 * `recordRecentSearch` persists the title that was rendered at the time, which
 * is right for a product or an order — that text is data — and wrong for the
 * palette’s own chrome. Without `liveTitle`, a shop that renames its products
 * still opens Ctrl+K to "Add new cake" on every machine where somebody once
 * clicked it, forever, and no unit test or fresh browser would ever show it.
 */
export function recentSearchToResult(
  entry: RecentSearchEntry,
  liveTitle?: string,
): GlobalSearchResult {
  return {
    id: entry.id,
    group: entry.group,
    title: liveTitle ?? entry.title,
    subtitle: entry.subtitle,
    href: entry.href,
  };
}
