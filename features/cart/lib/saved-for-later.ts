import type { CartLineItem } from "@/features/cart/lib/cart";

const STORAGE_KEY = "bakery-cms-saved-for-later";

export const SAVED_FOR_LATER_UPDATED_EVENT = "bakery-saved-for-later-updated";

function notifySavedUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAVED_FOR_LATER_UPDATED_EVENT));
}

function readSavedItems(): CartLineItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLineItem[];
    return Array.isArray(parsed) ? parsed : [];
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
  const existing = items.find((saved) => saved.id === item.id);

  if (existing) {
    existing.quantity += item.quantity;
    existing.price = item.price;
    writeSavedItems(items);
    return;
  }

  writeSavedItems([{ ...item, id: `saved-${item.id}` }, ...items]);
}

export function removeSavedForLaterItem(savedId: string): void {
  writeSavedItems(readSavedItems().filter((item) => item.id !== savedId));
}

export function clearSavedForLater(): void {
  writeSavedItems([]);
}
