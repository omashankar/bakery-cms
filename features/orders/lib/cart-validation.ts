import type { CartLineItem } from "@/features/cart/lib/cart";
import type { LandingProduct } from "@/constants/landing-data";

/**
 * Re-check a cart against the live catalogue before payment.
 *
 * Cart lines are a snapshot: they store the name and price from the moment the
 * item was added and are never refreshed. A cart that has been sitting in
 * localStorage can therefore contain a product that has since been unpublished,
 * gone out of stock, been deleted, or been repriced — and nothing downstream
 * noticed, so the order went through at the old price.
 */

export type CartIssueKind = "unavailable" | "out-of-stock" | "price-changed";

export interface CartIssue {
  productSlug: string;
  name: string;
  kind: CartIssueKind;
  message: string;
  /** Current price, when it differs from the price on the cart line. */
  currentPrice?: number;
}

export function validateCartAgainstCatalog(
  items: CartLineItem[],
  catalog: LandingProduct[]
): CartIssue[] {
  const bySlug = new Map(catalog.map((product) => [product.slug, product]));
  const issues: CartIssue[] = [];

  for (const item of items) {
    const product = bySlug.get(item.productSlug);

    // Absent from the published catalogue: deleted, unpublished, or renamed.
    if (!product) {
      issues.push({
        productSlug: item.productSlug,
        name: item.name,
        kind: "unavailable",
        message: `${item.name} is no longer available`,
      });
      continue;
    }

    if (product.inStock === false) {
      issues.push({
        productSlug: item.productSlug,
        name: item.name,
        kind: "out-of-stock",
        message: `${item.name} is out of stock`,
      });
    }
  }

  return issues;
}

export function hasBlockingCartIssues(issues: CartIssue[]): boolean {
  return issues.some((issue) => issue.kind !== "price-changed");
}
