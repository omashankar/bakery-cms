/**
 * Regression tests for checkout defects found auditing the flow.
 *
 * These were all reachable by a customer: a discount that survived the cart it
 * was earned on, an order number that could collide, a double-click that made
 * two orders, and a cart that could pay for a product no longer on sale.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { applyCouponCode, revalidateCoupon } from "@/features/orders/lib/coupons";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { getOrders, placeOrder } from "@/features/orders/lib/orders";
import {
  hasBlockingCartIssues,
  validateCartAgainstCatalog,
} from "@/features/orders/lib/cart-validation";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { CartLineItem } from "@/features/cart/lib/cart";
import type { LandingProduct } from "@/constants/landing-data";

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    id: "line-1",
    productSlug: "black-forest",
    name: "Black Forest",
    image: "",
    price: 500,
    quantity: 1,
    ...overrides,
  };
}

function product(overrides: Partial<LandingProduct> = {}): LandingProduct {
  return {
    id: "p1",
    slug: "black-forest",
    name: "Black Forest",
    description: "",
    image: "",
    category: "Chocolate",
    price: 500,
    ...overrides,
  };
}

const address = {
  fullName: "Asha",
  email: "asha@example.com",
  phone: "+919999999999",
  addressLine1: "1 Baker Street",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
};

beforeEach(() => {
  localStorage.clear();
});

describe("a coupon cannot outlive the cart it was earned on", () => {
  it("drops a coupon once the cart falls below its minimum", () => {
    // WED2026 is flat 2000 off with a 10,000 minimum — the worst case, because
    // a flat discount does not shrink with the cart.
    const earned = applyCouponCode("WED2026", 12000);
    expect(earned.ok).toBe(true);
    if (!earned.ok) return;
    expect(earned.coupon.discountAmount).toBe(2000);

    // Shrink the cart below the minimum: the coupon must stop applying.
    expect(revalidateCoupon(earned.coupon, 500)).toBeNull();
  });

  it("keeps a coupon that still qualifies", () => {
    const earned = applyCouponCode("WED2026", 12000);
    expect(earned.ok).toBe(true);
    if (!earned.ok) return;

    expect(revalidateCoupon(earned.coupon, 12000)?.code).toBe(earned.coupon.code);
  });

  it("rescales a percentage coupon to the smaller cart instead of reusing the old amount", () => {
    const earned = applyCouponCode("BDAY20", 5000);
    expect(earned.ok).toBe(true);
    if (!earned.ok) return;
    expect(earned.coupon.discountAmount).toBe(1000); // 20% of 5,000

    // Same coupon, smaller cart — 20% of 500, not the frozen 1,000.
    expect(revalidateCoupon(earned.coupon, 500)?.discountAmount).toBe(100);
  });

  it("a stale discount would otherwise drive the total to zero", () => {
    // Documents why this matters: the frozen ₹1,000 discount on a ₹500 cart
    // produces a free order, and Math.max(total, 0) hides it.
    const totals = calculateCartTotals({
      items: [line({ price: 500 })],
      discount: 1000,
      commerceOverride: { ...defaultCommerceSettings, deliveryFee: 99 },
    });

    expect(totals.total).toBe(0);
  });

  it("revalidating first keeps the customer paying", () => {
    const earned = applyCouponCode("WED2026", 12000);
    if (!earned.ok) return;

    const totals = calculateCartTotals({
      items: [line({ price: 500 })],
      discount: revalidateCoupon(earned.coupon, 500)?.discountAmount ?? 0,
      commerceOverride: { ...defaultCommerceSettings, deliveryFee: 99 },
    });

    expect(totals.total).toBeGreaterThan(0);
  });
});

describe("order numbers are unique", () => {
  it("does not reuse a number across many orders", () => {
    const numbers = new Set<string>();

    for (let i = 0; i < 60; i += 1) {
      const order = placeOrder({
        items: [line({ price: 100 + i })],
        totals: calculateCartTotals({
          items: [line({ price: 100 + i })],
          commerceOverride: defaultCommerceSettings,
        }),
        address: { ...address, phone: `+9199999${String(i).padStart(5, "0")}` },
        paymentMethod: "cod",
      });
      numbers.add(order.orderNumber);
    }

    expect(numbers.size).toBe(60);
  });
});

describe("placing an order is idempotent under a double-click", () => {
  it("returns the same order instead of creating a second one", () => {
    const items = [line()];
    const totals = calculateCartTotals({ items, commerceOverride: defaultCommerceSettings });

    const first = placeOrder({ items, totals, address, paymentMethod: "cod" });
    const second = placeOrder({ items, totals, address, paymentMethod: "cod" });

    expect(second.id).toBe(first.id);
    expect(getOrders()).toHaveLength(1);
  });

  it("still allows a genuinely different order", () => {
    const items = [line()];
    const totals = calculateCartTotals({ items, commerceOverride: defaultCommerceSettings });
    placeOrder({ items, totals, address, paymentMethod: "cod" });

    const otherItems = [line({ productSlug: "red-velvet", price: 700 })];
    placeOrder({
      items: otherItems,
      totals: calculateCartTotals({
        items: otherItems,
        commerceOverride: defaultCommerceSettings,
      }),
      address,
      paymentMethod: "cod",
    });

    expect(getOrders()).toHaveLength(2);
  });
});

describe("a stale cart cannot pay for something no longer on sale", () => {
  it("flags a product missing from the published catalogue", () => {
    // Exactly the screenshot case: a draft product still sitting in the cart.
    const issues = validateCartAgainstCatalog([line({ productSlug: "red-velvet" })], [product()]);

    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("unavailable");
    expect(hasBlockingCartIssues(issues)).toBe(true);
  });

  it("flags an out-of-stock product", () => {
    const issues = validateCartAgainstCatalog([line()], [product({ inStock: false })]);

    expect(issues[0].kind).toBe("out-of-stock");
    expect(hasBlockingCartIssues(issues)).toBe(true);
  });

  it("passes a cart whose items are all published and in stock", () => {
    const issues = validateCartAgainstCatalog([line()], [product({ inStock: true })]);

    expect(issues).toHaveLength(0);
    expect(hasBlockingCartIssues(issues)).toBe(false);
  });

  it("reports every bad line, not just the first", () => {
    const issues = validateCartAgainstCatalog(
      [line({ productSlug: "gone-1" }), line({ productSlug: "gone-2", id: "line-2" })],
      [product()]
    );

    expect(issues).toHaveLength(2);
  });
});
