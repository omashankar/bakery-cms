import { addToCart } from "@/features/cart/lib/cart";
import { getProductBySlug } from "@/features/products/lib/product-catalog";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { getOrderByNumber, getOrders } from "@/features/orders/lib/orders";

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
    const cake = getProductBySlug(item.productSlug);
    if (!cake || cake.inStock === false) {
      skipped += 1;
      unavailable.push(item.name);
      continue;
    }

    addToCart({
      productSlug: item.productSlug,
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
      counts.set(item.productSlug, (counts.get(item.productSlug) ?? 0) + item.quantity);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
    .slice(0, limit);
}
