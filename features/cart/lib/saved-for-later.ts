import type { CartLineItem } from "@/features/cart/lib/cart";

const STORAGE_KEY = "bakery-cms-saved-for-later";

export const SAVED_FOR_LATER_UPDATED_EVENT = "bakery-saved-for-later-updated";

function notifySavedUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAVED_FOR_LATER_UPDATED_EVENT));
}

/** The id a cart line takes once it is saved. One place, so the two agree. */
export function savedIdFor(cartLineId: string): string {
  return cartLineId.startsWith("saved-") ? cartLineId : `saved-${cartLineId}`;
}

function readSavedItems(): CartLineItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLineItem[];
    if (!Array.isArray(parsed)) return [];

    /**
     * Collapse rows that share an id.
     *
     * `addSavedForLaterItem` stored `saved-<id>` and looked for `<id>`, so its
     * merge branch could never match and saving the same line twice wrote a
     * SECOND row under the same id. Removing or restoring one then took both
     * with it, because both are matched by id.
     *
     * The write side is fixed below, but browsers are already holding the
     * duplicates. Merging them on read heals those quietly, and the next write
     * persists the healed list.
     */
    const merged: CartLineItem[] = [];
    const seen = new Map<string, CartLineItem>();
    for (const item of parsed) {
      const existing = seen.get(item.id);
      if (existing) {
        existing.quantity += item.quantity;
        continue;
      }
      const copy = { ...item };
      seen.set(item.id, copy);
      merged.push(copy);
    }
    return merged;
  } catch {
    return [];
  }
}

function writeSavedItems(items: CartLineItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notifySavedUpdated();
}

export function getSavedForLaterItems(): CartLineItem[] {
  return readSavedItems();
}

export function getSavedForLaterCount(): number {
  return readSavedItems().length;
}

export function addSavedForLaterItem(item: CartLineItem): void {
  const items = readSavedItems();
  // Matched on the id this row will be STORED under. It used to look for the
  // unprefixed cart id, which no stored row ever carries, so the merge below
  // was unreachable and a second save wrote a duplicate under the same id.
  const savedId = savedIdFor(item.id);
  const existing = items.find((saved) => saved.id === savedId);

  if (existing) {
    existing.quantity += item.quantity;
    existing.price = item.price;
    writeSavedItems(items);
    return;
  }

  writeSavedItems([{ ...item, id: savedId }, ...items]);
}

export function removeSavedForLaterItem(savedId: string): void {
  writeSavedItems(readSavedItems().filter((item) => item.id !== savedId));
}

export function clearSavedForLater(): void {
  writeSavedItems([]);
}
