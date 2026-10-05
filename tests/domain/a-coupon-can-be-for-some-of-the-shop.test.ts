/**
 * "20% OFF PLANTS" HAS TO MEAN OFF THE PLANTS.
 *
 * A coupon discounted the whole basket, always. A shop selling cakes AND plants
 * AND phone chargers could not run an offer on one of them without running it
 * on all three — so the only safe promotion was a shop-wide one, and a shop
 * with mixed stock had no way to move the stock that was sitting.
 *
 * A coupon now carries `categoryIds`. This covers the three ways that goes
 * wrong, and each of them is money:
 *
 *  1. THE DISCOUNT. ₹1,000 of plants beside ₹2,000 of cake, 20% off plants, is
 *     ₹200 — not ₹600. Measuring against the cart total would give the cake
 *     away with the plants.
 *  2. THE MINIMUM. "Over ₹2,000" on a plants coupon means ₹2,000 of PLANTS,
 *     because that is what the offer says. Measuring it against the cart total
 *     lets a big cake order unlock a plants discount nobody qualified for.
 *  3. EVERY COUPON THAT ALREADY EXISTS. Not one coupon in the shop has this
 *     field. `.lean()` reads them back `undefined` while anything saved since
 *     gets `[]` from the schema default, and a check that treated those two
 *     differently would turn every live code into one that discounts nothing —
 *     silently, because the refusal reads "Coupon cannot be applied to this
 *     order".
 *
 * The same function decides this for the browser and for the server, which is
 * why the browser can preview a discount at all. A test that only covered one
 * side would miss the case where they disagree and checkout refuses the order.
 */
import { describe, expect, it } from "vitest";

import {
  couponEligibleSubtotal,
  evaluateCoupon,
  type CouponCartLine,
  type CouponRule,
} from "@/features/orders/lib/coupons";
import { offersForCart, selectStorefrontOffers } from "@/features/commerce/lib/coupon-offers";
import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";

const PLANTS = "cat-plants";
const CAKES = "cat-cakes";

/** ₹1,000 of plants and ₹2,000 of cake, in one basket. */
const MIXED: CouponCartLine[] = [
  { productSlug: "money-plant", categoryIds: [PLANTS], price: 500, quantity: 2 },
  { productSlug: "truffle-cake", categoryIds: [CAKES], price: 1000, quantity: 2 },
];

function rule(overrides: Partial<CouponRule> = {}): CouponRule {
  return { code: "PLANTS20", label: "20% off plants", percentOff: 20, ...overrides };
}

const evaluate = (coupon: CouponRule, cart: Parameters<typeof evaluateCoupon>[2]) =>
  evaluateCoupon([coupon], coupon.code, cart);

describe("a coupon scoped to a category discounts only that category", () => {
  it("takes its percentage off the plants, not off the cake beside them", () => {
    const result = evaluate(rule({ categoryIds: [PLANTS] }), MIXED);

    expect(result.ok).toBe(true);
    // 20% of ₹1,000, not 20% of ₹3,000.
    expect(result.ok && result.coupon.discountAmount).toBe(200);
  });

  it("and says what it was taken from, so the number can be checked", () => {
    const result = evaluate(rule({ categoryIds: [PLANTS] }), MIXED);

    expect(result.ok && result.coupon.eligibleSubtotal).toBe(1000);
  });

  it("refuses outright when the basket holds none of them", () => {
    /**
     * The eligible subtotal is 0, so every arithmetic branch yields 0 and the
     * existing `discountAmount <= 0` refusal catches it. Worth pinning: without
     * it a customer would see a coupon "applied" for ₹0 and a green chip
     * claiming a saving.
     */
    const onlyCake = MIXED.filter((line) => line.categoryIds.includes(CAKES));
    const result = evaluate(rule({ categoryIds: [PLANTS] }), onlyCake);

    expect(result.ok).toBe(false);
  });

  it("counts a product filed under the category as well as its own", () => {
    /**
     * The whole point of multi-category membership. A "Truffle Cake With Money
     * Plant" filed primarily under Cakes and ALSO under Plants is a plant for
     * the purposes of a plants coupon — the shop said so when it ticked the box.
     */
    const combo: CouponCartLine[] = [
      { productSlug: "cake-and-plant", categoryIds: [CAKES, PLANTS], price: 1500, quantity: 1 },
    ];

    expect(evaluate(rule({ categoryIds: [PLANTS] }), combo)).toMatchObject({
      ok: true,
      coupon: { discountAmount: 300 },
    });
  });

  it("caps a flat discount at the eligible money, not at the cart total", () => {
    /**
     * "₹500 off plants" over ₹200 of plants takes ₹200. Capping against the
     * cart would let a plants coupon quietly pay for the cake.
     */
    const smallPlant: CouponCartLine[] = [
      { productSlug: "money-plant", categoryIds: [PLANTS], price: 200, quantity: 1 },
      { productSlug: "truffle-cake", categoryIds: [CAKES], price: 3000, quantity: 1 },
    ];
    const result = evaluate(
      rule({ code: "PLANTS500", percentOff: undefined, flatOff: 500, categoryIds: [PLANTS] }),
      smallPlant,
    );

    expect(result.ok && result.coupon.discountAmount).toBe(200);
  });
});

describe("the minimum is measured against what the coupon can touch", () => {
  it("refuses when the eligible items fall short, however big the basket", () => {
    // ₹1,000 of plants under a ₹2,000 plants minimum, beside ₹2,000 of cake.
    // The cart totals ₹3,000; the offer is about plants.
    const result = evaluate(rule({ categoryIds: [PLANTS], minSubtotal: 2000 }), MIXED);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/Minimum order/);
  });

  it("and allows it once the eligible items reach it", () => {
    const morePlants: CouponCartLine[] = [
      { productSlug: "money-plant", categoryIds: [PLANTS], price: 500, quantity: 4 },
    ];

    expect(evaluate(rule({ categoryIds: [PLANTS], minSubtotal: 2000 }), morePlants).ok).toBe(true);
  });
});

describe("an unscoped coupon behaves exactly as it always has", () => {
  /**
   * The compatibility half, and the one that would take the shop down. Every
   * coupon in this database predates the field.
   */
  it("discounts the whole basket when categoryIds is absent", () => {
    const result = evaluate(rule({ code: "SAVE20" }), MIXED);

    expect(result.ok && result.coupon.discountAmount).toBe(600);
  });

  it("and identically when it is an empty array", () => {
    /**
     * ABSENT AND EMPTY MUST NOT DIVERGE. `.lean()` gives an old document
     * `undefined`; the schema default gives a new one `[]`. If these two ever
     * disagree, half the shop's coupons stop working on a day nobody deployed
     * anything.
     */
    const result = evaluate(rule({ code: "SAVE20", categoryIds: [] }), MIXED);

    expect(result.ok && result.coupon.discountAmount).toBe(600);
  });

  it("and still works from a bare subtotal, for callers with no cart", () => {
    expect(evaluate(rule({ code: "SAVE20" }), 3000)).toMatchObject({
      ok: true,
      coupon: { discountAmount: 600 },
    });
  });
});

describe("a scoped coupon judged from a bare number refuses rather than guessing", () => {
  it("says so in words a customer can act on", () => {
    /**
     * Given only a total there is no way to know how much of it is plants.
     * Treating the total as eligible would discount the cake; treating it as
     * zero would refuse a code that should have worked, with a message about
     * the order. Both are silent. This is not.
     *
     * It also matters that the SERVER runs this same function: a browser that
     * took the generous branch could never talk the server into agreeing.
     */
    const result = evaluate(rule({ categoryIds: [PLANTS] }), 3000);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toBe("This code applies to selected items only");
  });
});

describe("the eligible subtotal itself", () => {
  it("is the whole cart with no scope", () => {
    expect(couponEligibleSubtotal({}, MIXED)).toBe(3000);
    expect(couponEligibleSubtotal({ categoryIds: [] }, MIXED)).toBe(3000);
  });

  it("is zero for a category the shop has deleted", () => {
    /**
     * A scope pointing at a category that no longer exists must match NOTHING.
     * The alternative — treating an unresolvable scope as no scope — turns a
     * dead coupon into a shop-wide one the moment somebody tidies the catalogue.
     */
    expect(couponEligibleSubtotal({ categoryIds: ["cat-gone"] }, MIXED)).toBe(0);
  });

  it("counts a line once even when two of its categories are in scope", () => {
    const combo: CouponCartLine[] = [
      { productSlug: "cake-and-plant", categoryIds: [CAKES, PLANTS], price: 1500, quantity: 1 },
    ];

    expect(couponEligibleSubtotal({ categoryIds: [CAKES, PLANTS] }, combo)).toBe(1500);
  });
});

describe("the offer card says the condition it will be held to", () => {
  const stored = (overrides: Partial<StoredCoupon> = {}): StoredCoupon =>
    ({
      id: "c1",
      code: "PLANTS20",
      label: "20% off plants",
      description: "",
      percentOff: 20,
      isActive: true,
      usageCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    }) as StoredCoupon;

  const NAMES = new Map([
    [PLANTS, "Money Plants"],
    [CAKES, "Celebration Cakes"],
  ]);

  it("names the categories when it can", () => {
    const [offer] = selectStorefrontOffers([stored({ categoryIds: [PLANTS] })], 1, {
      categoryNames: NAMES,
    });

    expect(offer.minSpend).toBe("On Money Plants");
  });

  it("still discloses the scope when it cannot name it", () => {
    /**
     * Names go missing two ways — a caller with no taxonomy, and a category the
     * shop deleted. Saying nothing would leave the card reading as an
     * unconditional 20% off, which is the same broken promise as a hidden
     * minimum and worse, because the customer cannot see it in their total
     * until the code is refused.
     */
    const [offer] = selectStorefrontOffers([stored({ categoryIds: ["cat-gone"] })], 1, {
      categoryNames: NAMES,
    });

    expect(offer.minSpend).toBe("On selected items");
  });

  it("says both conditions when there are two", () => {
    const [offer] = selectStorefrontOffers(
      [stored({ categoryIds: [PLANTS], minSubtotal: 500 })],
      1,
      { categoryNames: NAMES, currency: "INR" },
    );

    expect(offer.minSpend).toMatch(/Money Plants/);
    expect(offer.minSpend).toMatch(/over/i);
  });

  it("and an unscoped coupon reads exactly as it did before", () => {
    expect(selectStorefrontOffers([stored({ minSubtotal: 500 })], 1)[0].minSpend).toBe(
      "On orders over ₹500",
    );
    expect(selectStorefrontOffers([stored()], 1)[0].minSpend).toBeUndefined();
  });

  it("measures a cart's shortfall against the eligible items", () => {
    /**
     * "₹2,000 off plants" over ₹1,000 of plants beside ₹2,000 of cake still
     * needs ₹1,000 more of PLANTS. Reading the cart total would show the card
     * as already earned and send the customer to a checkout that refuses it —
     * the exact failure the shortfall exists to prevent.
     */
    const [offer] = offersForCart([stored({ categoryIds: [PLANTS], minSubtotal: 2000 })], MIXED);

    expect(offer.shortfall).toBe(1000);
  });

  it("and an unscoped one still measures against the whole cart", () => {
    const [offer] = offersForCart([stored({ minSubtotal: 2000 })], MIXED);

    expect(offer.shortfall).toBe(0);
  });
});
