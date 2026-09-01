import { addToCart } from "@/features/cart/lib/cart";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { getOrderByNumber, getOrders } from "@/features/orders/lib/orders";

export interface ReorderResult {
  added: number;
  skipped: number;
  unavailable: string[];
}

/** What reorder needs to know about a cake: does the shop still sell it. */
export interface ReorderCatalogueEntry {
  slug: string;
  image?: string;
  inStock?: boolean;
}

/**
 * Put a past order back in the cart.
 *
 * `catalogue` is the SHOP's published list, and it is a required argument on
 * purpose. This used to call `getProductBySlug`, which resolves against the
 * shipped demo constants merged with `loadProducts()` — the ADMIN's
 * localStorage cache, seeded with those same demo cakes and never populated in
 * a customer's browser, because `useProductCacheSync` runs only in the admin
 * layout.
 *
 * So reorder checked a real customer's real order against the demo catalogue.
 * Every line of a product the shop had actually created came back
 * "unavailable", `added` was 0, and the button reported "Could not reorder —
 * items may be unavailable" every single time. Passing the catalogue in makes
 * the caller say where it came from.
 */
export function reorderFromOrder(
  order: PlacedOrder,
  catalogue: ReorderCatalogueEntry[],
): ReorderResult {
  let added = 0;
  let skipped = 0;
  const unavailable: string[] = [];
  const bySlug = new Map(catalogue.map((entry) => [entry.slug, entry]));

  for (const item of order.items) {
    const cake = bySlug.get(item.productSlug);
    if (!cake || cake.inStock === false) {
      skipped += 1;
      unavailable.push(item.name);
      continue;
    }

    addToCart({
      productSlug: item.productSlug,
      name: item.name,
      image: item.image || cake.image || "",
      price: item.price,
      quantity: item.quantity,
      weight: item.weight,
      flavour: item.flavour,
      shape: item.shape,
      message: item.message,
      /**
       * The photo, which this dropped.
       *
       * `cartLineId` folds the photo, the message and the shape into the line's
       * identity precisely so two photo cakes carrying two different children's
       * photos stay two lines. Reordering passed the message and the shape and
       * not this, so it did both halves of the damage at once: the shop was
       * charged-for-but-not-given the photo it has to print, and two lines
       * differing only by photo collapsed into one of quantity 2 — the exact
       * bug `cartLineId`'s own comment records, reintroduced on the way back in.
       */
      photoUrl: item.photoUrl,
      deliveryDate: item.deliveryDate,
      deliveryTime: item.deliveryTime,
      variantSelections: item.variantSelections,
      variantSummary: item.variantSummary,
    });
    added += 1;
  }

  return { added, skipped, unavailable };
}

export function reorderFromOrderNumber(
  orderNumber: string,
  catalogue: ReorderCatalogueEntry[],
): ReorderResult | null {
  const order = getOrderByNumber(orderNumber);
  if (!order) return null;
  return reorderFromOrder(order, catalogue);
}

export function getFrequentlyOrderedSlugs(limit = 6): string[] {
  const counts = new Map<string, number>();

  for (const order of getOrders()) {
    for (const item of order.items) {
      counts.set(item.productSlug, (counts.get(item.productSlug) ?? 0) + item.quantity);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
    .slice(0, limit);
}
