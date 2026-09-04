import { weightAxisLabel } from "@/features/products/lib/product-pricing";
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
  /** What the shop calls the size axis, stamped when the line was made. */
  weightLabel?: string;
  /**
   * The struck-through price for THIS configuration, or absent.
   *
   * Stamped when the line was made, because it cannot be worked out later:
   * the cart holds lines, not products, and the card projection the cart page
   * is handed carries a price that has already been shifted by every default
   * option — so recomputing here would strike a different number from the one
   * the customer was shown on the product page.
   *
   * Absent unless the SHOP typed a compare-at above its own base price.
   * `displayCompareAtPrice` answers undefined otherwise, and a struck-through
   * number is a claim about the past that only the shop can make.
   */
  compareAtPrice?: number;
  flavour?: string;
  shape?: string;
  message?: string;
  /** A photo cake's uploaded image, stored where the bakery can open it. */
  photoUrl?: string;
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
  weightLabel?: string;
  compareAtPrice?: number;
  flavour?: string;
  shape?: string;
  message?: string;
  /** A photo cake's uploaded image, stored where the bakery can open it. */
  photoUrl?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  variantSelections?: Record<string, string>;
  variantSummary?: string[];
}

/**
 * Everything the customer chose about this line, as one list.
 *
 * Six screens built this string independently and every one of them picked a
 * different subset: the invoice took weight/shape/flavour, the checkout summary
 * took weight/flavour, saved-for-later took weight/flavour/shape, and the
 * account order list took none of it at all.
 *
 * The cart line and the product page DID render `variantSummary` — an earlier
 * version of this note said no surface did, which was wrong and worth
 * correcting rather than quietly deleting. The defect was narrower and worse:
 * every surface AFTER checkout omitted it. So a customer who paid ₹5,000 more
 * for 256 GB saw it while choosing, and then nowhere again — not on the
 * invoice, not in their order history, not in any email.
 *
 * They were charged for it the whole time. `priceLine` applies every enabled
 * group and stamps the summary from the same list it priced from.
 *
 * One function, so a seventh surface cannot invent a seventh subset and a new
 * field reaches every screen at once.
 */
export function cartLineChoices(
  item: Pick<CartLineItem, "weight" | "weightLabel" | "flavour" | "shape" | "variantSummary">,
): string[] {
  /**
   * EVERY value labelled, because a bare one is unreadable next to another.
   *
   * `variantSummary` has always carried “Shape: Heart”, and the three legacy
   * fields carried bare values — so a line read “1 kg · Chocolate · Round ·
   * Egg preference: Eggless”, and on a t-shirt it would read “M · Black” with
   * nothing saying which was the size. Naming them costs nothing and makes the
   * invoice and the kitchen email legible for any trade.
   *
   * These three are LEGACY and read-only: nothing writes them any more — shape
   * and flavour became variant groups, and their labels come from the group a
   * shop named. They stay because orders already placed carry them, and this
   * is what renders those.
   */
  const labelled = [
    // The shop's own word, so the invoice and the kitchen email head the
    // value exactly as the product page did. Lines made before the shop
    // named the axis, and orders already placed, fall back to the generic.
    [weightAxisLabel(item.weightLabel), item.weight],
    ["Flavour", item.flavour],
    ["Shape", item.shape],
  ] as const;

  return [
    ...labelled
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([label, value]) => `${label}: ${value}`),
    ...(item.variantSummary ?? []),
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
}

/**
 * A line already in the cart, ready to be put back.
 *
 * THREE places rebuild a line from a stored one — Undo after a removal,
 * Move-back from saved-for-later, and Reorder from a placed order — and each
 * wrote out the field list by hand. Every time a field was added to the line,
 * three lists had to be remembered, and the history says they were not:
 * `photoUrl` was missing from two of them, so Undo restored a photo cake with
 * nothing for the baker to print, and Reorder collapsed two children’s photos
 * into one line of quantity 2.
 *
 * The newest field, `weightLabel`, was missing from all three, and that one is
 * worse than a drop: `addToCart`’s merge branch assigns whatever it is handed,
 * so restoring a line ERASED the label off the line already in the cart.
 *
 * One function, so a fourth rebuild cannot invent a fourth subset.
 */
export function cartLineToAddInput(
  item: CartLineItem,
  overrides: Partial<AddToCartInput> = {},
): AddToCartInput {
  return {
    productSlug: item.productSlug,
    name: item.name,
    image: item.image,
    price: item.price,
    quantity: item.quantity,
    weight: item.weight,
    weightLabel: item.weightLabel,
    compareAtPrice: item.compareAtPrice,
    flavour: item.flavour,
    shape: item.shape,
    message: item.message,
    photoUrl: item.photoUrl,
    deliveryDate: item.deliveryDate,
    deliveryTime: item.deliveryTime,
    variantSelections: item.variantSelections,
    variantSummary: item.variantSummary,
    ...overrides,
  };
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
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // A browser at its storage limit must not make the cart throw. The item is
    // already in the React state that called this, so the customer's own screen
    // stays correct for the pageview; what is lost is the copy that survives a
    // reload. See the note on writeOrders for how this origin fills up.
  }
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

/**
 * The id a set of choices takes in the cart. Two adds of the same cake, size,
 * flavour and options are one line.
 *
 * Exported because callers other than `addToCart` need to find the line a set
 * of choices WOULD land on — restoring a saved item, for one, which has to know
 * whether that line is already in the cart before it decides whose price wins.
 */
export function cartLineId(
  input: Pick<
    AddToCartInput,
    "productSlug" | "weight" | "flavour" | "shape" | "message" | "photoUrl" | "variantSelections"
  >,
): string {
  const variantKey = input.variantSelections
    ? Object.entries(input.variantSelections)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([groupId, optionId]) => `${groupId}:${optionId}`)
        .join("|")
    : "default";

  /**
   * The PERSONALISATION is part of the identity, not decoration on top of it.
   *
   * This keyed on slug, weight, flavour and variants only, so two adds of the
   * same cake differing solely in shape, message or photo collapsed onto one
   * line — and `addToCart`'s merge branch then overwrites `message` and
   * `photoUrl` with the second add's values while keeping quantity 2. A
   * customer ordering two photo cakes, one photo per child, got one line for
   * two cakes carrying one photo; the baker made the same cake twice. Ordering
   * a heart for one person and a round for another lost the heart entirely.
   *
   * Hashed rather than concatenated: a message is free text that can be long
   * and can contain the separator, and a photo URL is longer still. The digest
   * keeps the id short and stable, and only ever has to distinguish, never be
   * read back.
   */
  const personal = digest(
    [input.shape ?? "", input.message ?? "", input.photoUrl ?? ""].join("\0"),
  );

  return `${input.productSlug}-${input.weight ?? "default"}-${input.flavour ?? "default"}-${variantKey}-${personal}`;
}

/**
 * Give every line an `id`, without disturbing the ones that have one.
 *
 * An order's items are NOT the cart's items. The server re-prices what the
 * customer chose — `QuoteLineInput` deliberately carries only the slug,
 * quantity and personalisation, because the price is the shop's to decide — and
 * the priced line it builds from that had no `id` at all. So every order placed
 * through checkout stored items with no identity, and the three screens that
 * render an order keyed their rows on `undefined`: React warned, and two rows
 * of the same cake in different sizes became one key.
 *
 * The id is the same deterministic hash the cart uses, so a line means the same
 * thing on both sides of checkout. De-duplicated within the order because a
 * React key has to be unique in its list and nothing upstream guarantees two
 * lines differ — the cart merges identical personalisations, but an order is
 * whatever arrived.
 *
 * Idempotent: a line that already has an id keeps it, so this is safe to run on
 * every read of every order, which is what repairs the ones already stored.
 */
export function withStableLineIds<
  T extends Parameters<typeof cartLineId>[0] & { id?: string },
>(items: T[]): T[] {
  const used = new Set(items.map((item) => item.id).filter(Boolean) as string[]);

  return items.map((item) => {
    if (item.id) return item;

    const base = cartLineId(item);
    let id = base;
    // Only ever reached by two lines the cart would have merged, which means
    // they arrived separately. Suffixed rather than dropped: losing a line from
    // an invoice is worse than an id nobody reads.
    for (let attempt = 2; used.has(id); attempt += 1) id = `${base}-${attempt}`;
    used.add(id);

    return { ...item, id };
  });
}

/** Short, stable, collision-resistant enough to tell two personalisations apart. */
function digest(value: string): string {
  if (!value.replace(/\0/g, "")) return "plain";
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function addToCart(input: AddToCartInput): CartLineItem {
  const items = readCart();
  const lineId = cartLineId(input);
  const existing = items.find((item) => item.id === lineId);

  if (existing) {
    existing.quantity += input.quantity;
    existing.price = input.price;
    existing.message = input.message;
    existing.photoUrl = input.photoUrl;
    existing.deliveryDate = input.deliveryDate;
    existing.deliveryTime = input.deliveryTime;
    // Refreshed like the price: the shop may have renamed the axis since
    // this line was made, and the two must not disagree within one cart.
    existing.weightLabel = input.weightLabel;
    existing.compareAtPrice = input.compareAtPrice;
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
    weightLabel: input.weightLabel,
    compareAtPrice: input.compareAtPrice,
    flavour: input.flavour,
    shape: input.shape,
    message: input.message,
    photoUrl: input.photoUrl,
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

  /**
   * The price the cart is ALREADY showing wins, when the line is already there.
   *
   * A saved item carries whatever the price was when it was saved, and
   * `addToCart` overwrites the existing line's price with whatever it is
   * handed. So restoring a cake saved last month rewrote the price of the units
   * the customer had just added at today's price — the number on screen went
   * backwards, and the shop reprices at checkout anyway. Between two stale
   * prices, the one the customer is looking at is the less wrong one.
   */
  const inCart = readCart().find((entry) => entry.id === cartLineId(savedItem));

  addToCart(
    cartLineToAddInput(savedItem, {
      price: inCart ? inCart.price : savedItem.price,
      /**
       * And the strike that belongs to THAT price.
       *
       * Overriding the price alone put the cart's current price beside the
       * saved line's month-old compare-at — so a shop that had since dropped
       * its price, or dropped the offer entirely, had a discount invented for
       * it out of two numbers that were never quoted together.
       */
      compareAtPrice: inCart ? inCart.compareAtPrice : savedItem.compareAtPrice,
    }),
  );
  removeSavedForLaterItem(savedId);
  return true;
}

export function clearCartPreferences(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_PREFS_KEY);
  notifyPreferencesUpdated();
}
