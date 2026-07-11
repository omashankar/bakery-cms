import { addToCart } from "@/features/storefront/lib/cart";
import { getCakeBySlug } from "@/features/storefront/lib/catalog";
import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { getOrderByNumber, getOrders } from "@/features/storefront/checkout/lib/orders";

export interface ReorderResult {
  added: number;
  skipped: number;
  unavailable: string[];
}

export function reorderFromOrder(order: PlacedOrder): ReorderResult {
  let added = 0;
  let skipped = 0;
  const unavailable: string[] = [];

  for (const item of order.items) {
    const cake = getCakeBySlug(item.cakeSlug);
    if (!cake || cake.inStock === false) {
      skipped += 1;
      unavailable.push(item.name);
      continue;
    }

    addToCart({
      cakeSlug: item.cakeSlug,
      name: item.name,
      image: item.image || cake.image,
      price: item.price,
      quantity: item.quantity,
      weight: item.weight,
      flavour: item.flavour,
      shape: item.shape,
      message: item.message,
      deliveryDate: item.deliveryDate,
      deliveryTime: item.deliveryTime,
      variantSelections: item.variantSelections,
      variantSummary: item.variantSummary,
    });
    added += 1;
  }

  return { added, skipped, unavailable };
}

export function reorderFromOrderNumber(orderNumber: string): ReorderResult | null {
  const order = getOrderByNumber(orderNumber);
  if (!order) return null;
  return reorderFromOrder(order);
}

export function getFrequentlyOrderedSlugs(limit = 6): string[] {
  const counts = new Map<string, number>();

  for (const order of getOrders()) {
    for (const item of order.items) {
      counts.set(item.cakeSlug, (counts.get(item.cakeSlug) ?? 0) + item.quantity);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
    .slice(0, limit);
}
