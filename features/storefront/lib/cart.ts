import {
  addSavedForLaterItem,
  getSavedForLaterItems,
  removeSavedForLaterItem,
} from "@/features/storefront/lib/saved-for-later";

const CART_STORAGE_KEY = "bakery-cms-cart";
const CART_PREFS_KEY = "bakery-cms-cart-preferences";

export const CART_PREFERENCES_UPDATED_EVENT = "bakery-cart-preferences-updated";

export interface CartPreferences {
  giftWrap: boolean;
  specialInstructions: string;
}

const defaultCartPreferences: CartPreferences = {
  giftWrap: false,
  specialInstructions: "",
};

export interface CartLineItem {
  id: string;
  cakeSlug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  weight?: string;
  flavour?: string;
  shape?: string;
  message?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  variantSelections?: Record<string, string>;
  variantSummary?: string[];
}

export interface AddToCartInput {
  cakeSlug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  weight?: string;
  flavour?: string;
  shape?: string;
  message?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  variantSelections?: Record<string, string>;
  variantSummary?: string[];
}

function notifyCartUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("bakery-cart-updated"));
}

function readCart(): CartLineItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLineItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartLineItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function getCartItems(): CartLineItem[] {
  return readCart();
}

export function getCartItemCount(): number {
  return readCart().reduce((sum, item) => sum + item.quantity, 0);
}

export function setCartItems(items: CartLineItem[]): void {
  writeCart(items);
}

export function clearCart(): void {
  writeCart([]);
  notifyCartUpdated();
}

export function addToCart(input: AddToCartInput): CartLineItem {
  const items = readCart();
  const variantKey = input.variantSelections
    ? Object.entries(input.variantSelections)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([groupId, optionId]) => `${groupId}:${optionId}`)
        .join("|")
    : "default";
  const lineId = `${input.cakeSlug}-${input.weight ?? "default"}-${input.flavour ?? "default"}-${variantKey}`;
  const existing = items.find((item) => item.id === lineId);

  if (existing) {
    existing.quantity += input.quantity;
    existing.price = input.price;
    existing.message = input.message;
    existing.deliveryDate = input.deliveryDate;
    existing.deliveryTime = input.deliveryTime;
    existing.variantSelections = input.variantSelections;
    existing.variantSummary = input.variantSummary;
    writeCart(items);
    notifyCartUpdated();
    return existing;
  }

  const created: CartLineItem = {
    id: lineId,
    cakeSlug: input.cakeSlug,
    name: input.name,
    image: input.image,
    price: input.price,
    quantity: input.quantity,
    weight: input.weight,
    flavour: input.flavour,
    shape: input.shape,
    message: input.message,
    deliveryDate: input.deliveryDate,
    deliveryTime: input.deliveryTime,
    variantSelections: input.variantSelections,
    variantSummary: input.variantSummary,
  };

  writeCart([created, ...items]);
  notifyCartUpdated();
  return created;
}

export function updateCartItemQuantity(lineId: string, quantity: number): void {
  const items = readCart();
  const next =
    quantity <= 0
      ? items.filter((item) => item.id !== lineId)
      : items.map((item) => (item.id === lineId ? { ...item, quantity } : item));
  writeCart(next);
  notifyCartUpdated();
}

export function removeCartItem(lineId: string): void {
  writeCart(readCart().filter((item) => item.id !== lineId));
  notifyCartUpdated();
}

function notifyPreferencesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_PREFERENCES_UPDATED_EVENT));
}

export function getCartPreferences(): CartPreferences {
  if (typeof window === "undefined") return defaultCartPreferences;

  try {
    const raw = localStorage.getItem(CART_PREFS_KEY);
    if (!raw) return defaultCartPreferences;
    const parsed = JSON.parse(raw) as Partial<CartPreferences>;
    return { ...defaultCartPreferences, ...parsed };
  } catch {
    return defaultCartPreferences;
  }
}

export function saveCartPreferences(preferences: CartPreferences): CartPreferences {
  if (typeof window === "undefined") return preferences;
  localStorage.setItem(CART_PREFS_KEY, JSON.stringify(preferences));
  notifyPreferencesUpdated();
  return preferences;
}

export function updateCartPreferences(patch: Partial<CartPreferences>): CartPreferences {
  return saveCartPreferences({ ...getCartPreferences(), ...patch });
}

export function moveCartItemToSavedForLater(lineId: string): boolean {
  const items = readCart();
  const item = items.find((entry) => entry.id === lineId);
  if (!item) return false;

  addSavedForLaterItem(item);
  writeCart(items.filter((entry) => entry.id !== lineId));
  notifyCartUpdated();
  return true;
}

export function restoreSavedItemToCart(savedId: string): boolean {
  const savedItem = getSavedForLaterItems().find((item) => item.id === savedId);
  if (!savedItem) return false;

  addToCart({
    cakeSlug: savedItem.cakeSlug,
    name: savedItem.name,
    image: savedItem.image,
    price: savedItem.price,
    quantity: savedItem.quantity,
    weight: savedItem.weight,
    flavour: savedItem.flavour,
    shape: savedItem.shape,
    message: savedItem.message,
    deliveryDate: savedItem.deliveryDate,
    deliveryTime: savedItem.deliveryTime,
    variantSelections: savedItem.variantSelections,
    variantSummary: savedItem.variantSummary,
  });
  removeSavedForLaterItem(savedId);
  return true;
}

export function clearCartPreferences(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_PREFS_KEY);
  notifyPreferencesUpdated();
}
