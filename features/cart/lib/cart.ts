import {
  addSavedForLaterItem,
  getSavedForLaterItems,
  removeSavedForLaterItem,
} from "@/features/cart/lib/saved-for-later";

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
  productSlug: string;
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
  productSlug: string;
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

export const CART_UPDATED_EVENT = "bakery-cart-updated";

function notifyCartUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

/**
 * Subscribe to cart changes, including changes made in another tab.
 *
 * `dispatchEvent` only reaches the tab that made the change; the browser's
 * `storage` event is what crosses tabs. Without both, a customer who edits
 * their cart in a second tab can pay for the snapshot the checkout tab loaded
 * on mount.
 */
export function subscribeToCart(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CART_STORAGE_KEY) onChange();
  };

  window.addEventListener(CART_UPDATED_EVENT, onChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Carts saved before `cakeSlug` was renamed to `productSlug` still carry the old
 * key. Upgrade them on read so an in-progress cart survives the rename instead
 * of silently losing every line item's product reference.
 */
export function migrateLegacyCartItem<T extends object>(
  item: T
): Omit<T, "cakeSlug"> & { productSlug: string } {
  const legacy = item as T & { cakeSlug?: string; productSlug?: string };

  if (legacy.productSlug !== undefined || legacy.cakeSlug === undefined) {
    return item as Omit<T, "cakeSlug"> & { productSlug: string };
  }

  const { cakeSlug, ...rest } = legacy;
  return { ...rest, productSlug: cakeSlug } as Omit<T, "cakeSlug"> & { productSlug: string };
}

function readCart(): CartLineItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLineItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => migrateLegacyCartItem(item));
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
  const lineId = `${input.productSlug}-${input.weight ?? "default"}-${input.flavour ?? "default"}-${variantKey}`;
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
    productSlug: input.productSlug,
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
    productSlug: savedItem.productSlug,
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
