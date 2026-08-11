/**
 * What a catalogue card says a cake costs, and what the shop charges for it.
 *
 * `product.price` is the BASE price, and the shop does not charge the base.
 * With nothing selected the server still applies each variant group's default
 * option — `calculateVariantAdjustment` falls back to `isDefault`, then to the
 * first option — and those defaults are not always free. This shop's four
 * eggless cakes default to an "Eggless" option that adds ₹80.
 *
 * So every grid in the storefront showed ₹1,099, the cart carried ₹1,099, and
 * checkout repriced to ₹1,179 at the last step: "Prices have changed. This
 * order now comes to ₹1,179. Please review and place it again" — for a choice
 * the customer had never made.
 */
import { describe, expect, it } from "vitest";

import {
  calculateProductUnitPrice,
  defaultProductUnitPrice,
} from "@/features/products/lib/product-pricing";
import type { ProductVariantGroup } from "@/types/product";

/** The shape of this shop's eggless cakes, as stored. */
const eggPreference: ProductVariantGroup = {
  id: "egg",
  name: "Egg preference",
  options: [
    { id: "with-egg", label: "With Egg", priceAdjustment: 0, isDefault: false },
    { id: "eggless", label: "Eggless", priceAdjustment: 80, isDefault: true },
  ],
} as unknown as ProductVariantGroup;

describe("the price on a catalogue card", () => {
  it("includes a default option that is not free", () => {
    // eggless-chocolate-fudge, at the price the shop really stores.
    expect(defaultProductUnitPrice({ price: 1099, variantGroups: [eggPreference] })).toBe(1179);
  });

  it("agrees with what the shop charges for the same untouched cake", () => {
    const cake = { price: 1099, variantGroups: [eggPreference] };

    // What features/checkout/server/pricing.server.ts computes for a line with
    // no weight and no selections. If these two ever disagree, the customer
    // meets "Prices have changed" at the last step of checkout.
    const whatTheShopCharges = calculateProductUnitPrice({
      basePrice: cake.price,
      weightPrice: undefined,
      variantGroups: cake.variantGroups,
      variantSelections: {},
    });

    expect(defaultProductUnitPrice(cake)).toBe(whatTheShopCharges);
  });

  it("uses the first weight tier's own price when the product has tiers", () => {
    // The server prices index 0 when no size was chosen, and a tier carries an
    // absolute price rather than a modifier.
    const cake = {
      price: 1000,
      weights: [{ price: 1200 }, { price: 1800 }],
      variantGroups: [eggPreference],
    };

    expect(defaultProductUnitPrice(cake)).toBe(1280);
  });

  it("leaves an ordinary cake at its own price", () => {
    // Nothing to add: no groups, or a default that costs nothing.
    expect(defaultProductUnitPrice({ price: 750 })).toBe(750);
    expect(
      defaultProductUnitPrice({
        price: 750,
        variantGroups: [
          {
            id: "shape",
            name: "Shape",
            options: [{ id: "round", label: "Round", priceAdjustment: 0, isDefault: true }],
          } as unknown as ProductVariantGroup,
        ],
      }),
    ).toBe(750);
  });

  it("never goes below zero on a discount-shaped default", () => {
    expect(
      defaultProductUnitPrice({
        price: 100,
        variantGroups: [
          {
            id: "x",
            name: "X",
            options: [{ id: "a", label: "A", priceAdjustment: -500, isDefault: true }],
          } as unknown as ProductVariantGroup,
        ],
      }),
    ).toBe(0);
  });
});
