/**
 * Characterisation tests for the commerce seam.
 *
 * These pin CURRENT behaviour so the domain-layer extraction can be proven
 * behaviour-preserving. They intentionally assert what the code does today,
 * not what it ideally should do.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { computeTaxAmount, extractTaxSettings, formatTaxRatePercent } from "@/features/commerce/lib/tax-utils";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import type { CartLineItem } from "@/features/cart/lib/cart";
import type { CommerceSettings } from "@/types/settings";

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

function commerce(overrides: Partial<CommerceSettings> = {}): CommerceSettings {
  return { ...defaultCommerceSettings, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
});

describe("computeTaxAmount", () => {
  it("taxes subtotal minus discount, excluding delivery by default", () => {
    const result = computeTaxAmount(commerce(), { subtotal: 1000, discount: 200, delivery: 99 });

    expect(result.taxableAmount).toBe(800);
    expect(result.tax).toBe(40); // 800 * 0.05
    expect(result.platformCharge).toBe(0);
  });

  it("includes delivery in the taxable base when taxIncludeDelivery is on", () => {
    const result = computeTaxAmount(commerce({ taxIncludeDelivery: true }), {
      subtotal: 1000,
      discount: 0,
      delivery: 100,
    });

    expect(result.taxableAmount).toBe(1100);
    expect(result.tax).toBe(55);
  });

  it("never lets a discount larger than subtotal produce a negative taxable base", () => {
    const result = computeTaxAmount(commerce(), { subtotal: 100, discount: 500 });

    expect(result.taxableAmount).toBe(0);
    expect(result.tax).toBe(0);
  });

  it("returns zero tax when tax is disabled but still reports the taxable base", () => {
    const result = computeTaxAmount(commerce({ taxEnabled: false }), { subtotal: 1000 });

    expect(result.tax).toBe(0);
    expect(result.taxableAmount).toBe(1000);
  });

  it("applies a flat platform charge independently of tax", () => {
    const result = computeTaxAmount(
      commerce({ platformChargeEnabled: true, platformChargeAmount: 25 }),
      { subtotal: 1000 }
    );

    expect(result.platformCharge).toBe(25);
  });

  it("rounds tax to whole units", () => {
    const result = computeTaxAmount(commerce({ taxRate: 0.05 }), { subtotal: 333 });

    expect(result.tax).toBe(17); // 16.65 rounds to 17
    expect(Number.isInteger(result.tax)).toBe(true);
  });

  it("extractTaxSettings picks only the tax-relevant fields", () => {
    expect(Object.keys(extractTaxSettings(commerce())).sort()).toEqual([
      "platformChargeAmount",
      "platformChargeEnabled",
      "platformChargeLabel",
      "taxEnabled",
      "taxIncludeDelivery",
      "taxLabel",
      "taxRate",
    ]);
  });

  it("formats a tax rate as a percentage", () => {
    expect(formatTaxRatePercent(0.05)).toBe("5%");
    expect(formatTaxRatePercent(0.125)).toBe("12.5%");
  });
});

describe("calculateCartTotals", () => {
  it("returns an all-zero total for an empty cart and charges no delivery", () => {
    const totals = calculateCartTotals({ items: [], commerceOverride: commerce() });

    expect(totals.subtotal).toBe(0);
    expect(totals.itemCount).toBe(0);
    expect(totals.delivery).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("sums line items by price * quantity", () => {
    const totals = calculateCartTotals({
      items: [line({ price: 500, quantity: 2 }), line({ id: "line-2", price: 250, quantity: 1 })],
      commerceOverride: commerce(),
    });

    expect(totals.subtotal).toBe(1250);
    expect(totals.itemCount).toBe(3);
  });

  it("charges delivery below the free-delivery threshold", () => {
    const totals = calculateCartTotals({
      items: [line({ price: 500 })],
      commerceOverride: commerce({ freeDeliveryThreshold: 999, deliveryFee: 99 }),
    });

    expect(totals.delivery).toBe(99);
  });

  it("waives delivery at or above the free-delivery threshold", () => {
    const totals = calculateCartTotals({
      items: [line({ price: 999 })],
      commerceOverride: commerce({ freeDeliveryThreshold: 999, deliveryFee: 99 }),
    });

    expect(totals.delivery).toBe(0);
  });

  it("composes subtotal, delivery, tax and discount into the total", () => {
    const totals = calculateCartTotals({
      items: [line({ price: 500, quantity: 1 })],
      discount: 100,
      commerceOverride: commerce({ deliveryFee: 99, freeDeliveryThreshold: 999, taxRate: 0.05 }),
    });

    // subtotal 500 - discount 100 = 400 taxable -> tax 20; + delivery 99
    expect(totals.subtotal).toBe(500);
    expect(totals.discount).toBe(100);
    expect(totals.tax).toBe(20);
    expect(totals.delivery).toBe(99);
    expect(totals.total).toBe(519);
  });

  it("clamps the total at zero when the discount exceeds the order value", () => {
    const totals = calculateCartTotals({
      items: [line({ price: 100 })],
      discount: 100_000,
      commerceOverride: commerce({ taxEnabled: false, deliveryFee: 0 }),
    });

    expect(totals.total).toBe(0);
  });

  it("adds the gift wrap fee only when gift wrap is enabled and requested", () => {
    const withWrap = calculateCartTotals({
      items: [line()],
      giftWrap: true,
      commerceOverride: commerce({ giftWrapEnabled: true, giftWrapFee: 49 }),
    });
    const wrapRequestedButDisabled = calculateCartTotals({
      items: [line()],
      giftWrap: true,
      commerceOverride: commerce({ giftWrapEnabled: false, giftWrapFee: 49 }),
    });

    expect(withWrap.giftWrapFee).toBe(49);
    expect(wrapRequestedButDisabled.giftWrapFee).toBe(0);
  });

  it("does not charge gift wrap on an empty cart", () => {
    const totals = calculateCartTotals({
      items: [],
      giftWrap: true,
      commerceOverride: commerce({ giftWrapEnabled: true, giftWrapFee: 49 }),
    });

    expect(totals.giftWrapFee).toBe(0);
  });
});
