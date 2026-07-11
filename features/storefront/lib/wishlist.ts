const WISHLIST_STORAGE_KEY = "bakery-cms-wishlist";

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

  if (typeof window !== "undefined") {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("bakery-wishlist-updated"));
  }

  return !exists;
}

export function addToWishlist(slug: string): boolean {
  const current = getWishlistSlugs();
  if (current.includes(slug)) return false;

  if (typeof window !== "undefined") {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...current, slug]));
    window.dispatchEvent(new Event("bakery-wishlist-updated"));
  }

  return true;
}

export function getWishlistCount(): number {
  return getWishlistSlugs().length;
}
