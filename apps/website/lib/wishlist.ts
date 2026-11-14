
import { safeSetItem } from "@/lib/safe-storage";
import { writeWishlistCookie } from "./wishlist-cookie";
const WISHLIST_STORAGE_KEY = "bakery-cms-wishlist";

/**
 * Every write goes through here, so the copy the server reads
 * (wishlist-cookie.ts) can never fall behind the one in localStorage.
 */
function saveWishlist(next: string[]): void {
  safeSetItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
  writeWishlistCookie(next);
  window.dispatchEvent(new Event("bakery-wishlist-updated"));
}

/**
 * Bring the server-readable copy up to date with this browser. Called by the
 * header on every store page and on every wishlist change — which covers a
 * wishlist saved before the copy existed, and the sign-out that clears it.
 */
export function syncWishlistCookie(): void {
  if (typeof window === "undefined") return;
  writeWishlistCookie(getWishlistSlugs());
}

export function getWishlistSlugs(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isInWishlist(slug: string): boolean {
  return getWishlistSlugs().includes(slug);
}

export function toggleWishlist(slug: string): boolean {
  const current = getWishlistSlugs();
  const exists = current.includes(slug);
  const next = exists ? current.filter((item) => item !== slug) : [...current, slug];

  if (typeof window !== "undefined") saveWishlist(next);

  return !exists;
}

export function addToWishlist(slug: string): boolean {
  const current = getWishlistSlugs();
  if (current.includes(slug)) return false;

  if (typeof window !== "undefined") saveWishlist([...current, slug]);

  return true;
}

export function getWishlistCount(): number {
  return getWishlistSlugs().length;
}

/**
 * Forget saved cakes the shop no longer publishes.
 *
 * The wishlist stores slugs. The page resolves them against the published
 * catalogue and silently drops the ones it cannot find — but the header badge
 * counts the raw slugs, so a customer with two unpublished cakes saw "5" beside
 * the heart and three cards on the page, with no row for the missing two and so
 * no way to remove them. The two numbers were both describing the wishlist and
 * disagreeing about it.
 *
 * Called by the wishlist page, which is the one place that holds the published
 * catalogue. Returns how many were dropped so the page can say so rather than
 * quietly shrinking the list.
 */
export function pruneWishlist(availableSlugs: Iterable<string>): number {
  if (typeof window === "undefined") return 0;

  const available = new Set(availableSlugs);
  const current = getWishlistSlugs();
  const next = current.filter((slug) => available.has(slug));
  if (next.length === current.length) return 0;

  saveWishlist(next);
  return current.length - next.length;
}
