import { describe, expect, it } from "vitest";

import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { hasDeliverySlot } from "@/features/orders/lib/checkout-draft";
import type { CartLineItem } from "@/features/cart/lib/cart";
import type { CommerceSettings } from "@/types/settings";

/**
 * A SHOP MAY SELL MORE THAN ONE SPEED, AND ONLY THE SHOP SETS THE PRICE.
 *
 * The reference checkout offers Standard free, a fixed window for ₹150 and a
 * midnight delivery for ₹250. Those are three things one shop happens to sell.
 * A florist delivering within the hour and a furniture shop delivering within a
 * fortnight need their own words and their own prices, so nothing here is
 * hard-coded: the tiers are whatever the shop typed, and a shop that has typed
 * none behaves exactly as it did before tiers existed.
 *
 * The important property is the one a browser could otherwise break. The client
 * sends an ID and never an amount — the fee is looked up in the shop's own
 * settings on every pricing pass, the same way gift wrap takes a boolean and
 * reads `commerce.giftWrapFee`. A cart that could name its own surcharge could
 * also name a negative one.
 */

const LINE: CartLineItem = {
  id: "line-1",
  productSlug: "cotton-tee",
  name: "Cotton Tee",
  image: "",
  price: 1000,
  quantity: 1,
};

/** No tax and no base delivery, so the surcharge is the only thing moving. */
function shop(overrides: Partial<CommerceSettings> = {}): CommerceSettings {
  return {
    ...defaultCommerceSettings,
    taxEnabled: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    platformChargeEnabled: false,
    useZoneBasedDelivery: false,
    ...overrides,
  };
}

const TIERS = [
  { id: "std", label: "Standard", description: "", fee: 0, windows: ["10 AM - 12 PM"] },
  { id: "fixed", label: "Fixed time", description: "Pick an hour", fee: 150, windows: ["4 PM - 5 PM"] },
  { id: "midnight", label: "Midnight", description: "", fee: 250, windows: [] },
];

const price = (deliveryTierId: string | undefined, commerce: CommerceSettings) =>
  calculateCartTotals({ items: [LINE], deliveryTierId, commerceOverride: commerce });

describe("choosing a faster speed changes what the order costs", () => {
  const commerce = shop({ deliveryTiers: TIERS });

  it("adds the shop's own amount, and names it", () => {
    const standard = price("std", commerce);
    const fixed = price("fixed", commerce);

    expect(standard.deliveryTierFee).toBe(0);
    expect(fixed.deliveryTierFee).toBe(150);
    expect(fixed.total - standard.total).toBe(150);
    // Named, so a breakdown row can say what the money bought.
    expect(fixed.deliveryTierLabel).toBe("Fixed time");
  });

  it("takes the price from settings, never from the caller", () => {
    /**
     * The client sends an id. If it could send a fee, it could send a
     * different one — or a negative one — and the cart would agree.
     */
    const cheaper = shop({
      deliveryTiers: TIERS.map((tier) => (tier.id === "fixed" ? { ...tier, fee: 20 } : tier)),
    });

    expect(price("fixed", commerce).deliveryTierFee).toBe(150);
    expect(price("fixed", cheaper).deliveryTierFee).toBe(20);
  });

  it("ignores a fee sent alongside the id", () => {
    /**
     * What a hostile client would actually try. `CartTotalsInput` has no fee
     * field, so this is a cast — and the point is that adding one later, or
     * honouring a stray key, is caught here rather than in a shop's takings.
     */
    const forged = calculateCartTotals({
      items: [LINE],
      deliveryTierId: "fixed",
      deliveryTierFee: 1,
      commerceOverride: commerce,
    } as never);

    expect(forged.deliveryTierFee).toBe(150);
  });

  it("charges nothing for a tier the shop does not offer", () => {
    /**
     * A draft can name a tier the shop deleted while the customer was typing.
     * Pricing nothing is the safe answer; throwing would turn a stale draft
     * into a failed order after the money had moved.
     */
    expect(price("a-tier-that-was-deleted", commerce).deliveryTierFee).toBe(0);
  });

  it("charges nothing on an empty cart", () => {
    const empty = calculateCartTotals({
      items: [],
      deliveryTierId: "fixed",
      commerceOverride: commerce,
    });

    expect(empty.deliveryTierFee).toBe(0);
    expect(empty.total).toBe(0);
  });
});

describe("a shop that has set none up is untouched", () => {
  it("prices exactly as it did before tiers existed", () => {
    const plain = shop({ deliveryTiers: [] });

    expect(price(undefined, plain).deliveryTierFee).toBe(0);
    expect(price(undefined, plain).deliveryTierLabel).toBeUndefined();
    expect(price(undefined, plain).total).toBe(1000);
  });

  it("and ships no tiers of its own", () => {
    // Shipping a Standard / Fixed / Midnight default would be this software
    // deciding what every shop sells and what it charges for it.
    expect(defaultCommerceSettings.deliveryTiers).toEqual([]);
  });
});

describe("the surcharge is taxed like delivery, because it is delivery", () => {
  it("lands in the taxable base rather than on top of the total", () => {
    /**
     * Gift wrap had this bug once — added after tax and left out of the base
     * entirely. A faster delivery is the same supply, charged faster.
     */
    // A FRACTION, not a percentage — `clampRate` treats anything above 1 as
    // not a rate at all, which is what the comment beside it is for.
    const taxed = shop({
      deliveryTiers: TIERS,
      taxEnabled: true,
      taxRate: 0.1,
      taxIncludeDelivery: true,
    });

    const standard = calculateCartTotals({
      items: [LINE],
      deliveryTierId: "std",
      commerceOverride: taxed,
    });
    const fixed = calculateCartTotals({
      items: [LINE],
      deliveryTierId: "fixed",
      commerceOverride: taxed,
    });

    // 10% of the extra 150.
    expect(fixed.tax - standard.tax).toBe(15);
    expect(fixed.total - standard.total).toBe(165);
  });
});

describe("a speed with no window can still be booked", () => {
  it("counts as a booked delivery without one", () => {
    /**
     * A midnight or a next-day delivery has nothing to choose. Requiring a
     * window left the customer on a screen whose Continue button could not be
     * satisfied by anything on it.
     */
    expect(hasDeliverySlot({ date: "2026-08-01", timeSlot: "", tierId: "midnight" })).toBe(true);
  });

  it("while a date on its own is still not a booking", () => {
    expect(hasDeliverySlot({ date: "2026-08-01", timeSlot: "" })).toBe(false);
    expect(hasDeliverySlot({ date: "", timeSlot: "", tierId: "midnight" })).toBe(false);
  });
});
