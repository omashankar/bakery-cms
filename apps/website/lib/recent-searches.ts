/**
 * What this browser last searched for, shown under the header search box the
 * moment it is focused — before a letter is typed — as every shop a customer
 * already uses does.
 *
 * Two kinds of entry, from the two ways a search ends:
 *  - a typed word submitted with Enter or the magnifier: `{ term }`, which
 *    runs the search again;
 *  - a product picked from the suggestions: `{ term, slug, category }`, which
 *    goes back to that product and says which category it was in.
 *
 * On this device only, and cleared on sign-out with the rest of the
 * customer's browser data (`CUSTOMER_DEVICE_KEYS`): what someone searched for
 * is theirs, and the next person at a shared screen should not see it.
 */
import { safeSetItem } from "@/lib/safe-storage";

export const RECENT_SEARCHES_KEY = "bakery-cms-recent-searches";

/** As many as the reference shows. More is a list to read, not a shortcut. */
export const MAX_RECENT_SEARCHES = 5;

export interface RecentSearch {
  term: string;
  /** Set when the entry is a product picked from the suggestions. */
  slug?: string;
  category?: string;
}

function isRecentSearch(value: unknown): value is RecentSearch {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.term === "string" &&
    entry.term.trim() !== "" &&
    (entry.slug === undefined || typeof entry.slug === "string") &&
    (entry.category === undefined || typeof entry.category === "string")
  );
}

/** Newest first. Anything unreadable — a private window, a hand-edited key — is no history. */
export function loadRecentSearches(): RecentSearch[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch).slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

/**
 * The list with `entry` at the top.
 *
 * The same word searched twice is one row that moves up, not two rows — and
 * "Chocolate" and "chocolate " are the same word. A product is the same
 * entry as another only if it is the same product: a typed "red velvet" and
 * the Red Velvet Classic picked from the list go to different places.
 */
export function withRecentSearch(list: RecentSearch[], entry: RecentSearch): RecentSearch[] {
  const term = entry.term.trim();
  if (!term) return list;
  const fresh: RecentSearch = { term };
  if (entry.slug) fresh.slug = entry.slug;
  if (entry.slug && entry.category) fresh.category = entry.category;
  const same = (other: RecentSearch) =>
    fresh.slug
      ? other.slug === fresh.slug
      : !other.slug && other.term.trim().toLowerCase() === term.toLowerCase();
  return [fresh, ...list.filter((other) => !same(other))].slice(0, MAX_RECENT_SEARCHES);
}

/** Storage full or blocked is not an error here: the search itself still runs. */
export function rememberSearch(entry: RecentSearch): void {
  safeSetItem(RECENT_SEARCHES_KEY, JSON.stringify(withRecentSearch(loadRecentSearches(), entry)));
}

/** The rows to show for what is in the box: all of them when it is empty, else those it begins. */
export function recentSearchesFor(list: RecentSearch[], typed: string): RecentSearch[] {
  const start = typed.trim().toLowerCase();
  return start ? list.filter((entry) => entry.term.toLowerCase().startsWith(start)) : list;
}
