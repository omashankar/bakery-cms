import { describe, expect, it } from "vitest";

import { specialOffers, weddingCakes, type LandingProduct } from "@/constants/landing-data";
import {
  isLiveCoupon,
  isWeddingCoupon,
  selectStorefrontOffers,
  selectWeddingCouponOffers,
} from "@/features/commerce/lib/coupon-offers";
import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";
import { selectWeddingCollectionProducts } from "@/features/products/lib/wedding-catalog";

/**
 * A discount row is a promise.
 *
 * The homepage's "Special Offers" section mapped `specialOffers` — a hardcoded
 * array — and had no path to the coupon store at all, so it advertised
 * "Birthday Special · 20% OFF · code BDAY20" regardless of whether that coupon
 * existed, was active, or still gave 20%. Deactivate it in Coupons and the
 * homepage kept offering it to every visitor, with a code checkout then refused.
 * One of the three cards promised "buy 2 pastries, get 1 free" with no code at
 * all, and nothing in the system honoured it.
 *
 * The wedding page read real coupons but topped the row up from the same array
 * whenever there were too few, so it advertised invented codes for the same
 * reason. The product grid beside it did the same with `weddingCakes`.
 */

const NOW = Date.parse("2026-08-08T00:00:00.000Z");

function coupon(over: Partial<StoredCoupon> & { id: string; code: string }): StoredCoupon {
  return {
    label: "10% OFF",
    description: "A real discount",
    percentOff: 10,
    isActive: true,
    usageCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("storefront offers come from real coupons", () => {
  it("shows only coupons checkout would accept", () => {
    const offers = selectStorefrontOffers(
      [
        coupon({ id: "a", code: "LIVE10" }),
        coupon({ id: "b", code: "OFF10", isActive: false }),
        coupon({ id: "c", code: "GONE10", expiresAt: "2026-07-01T00:00:00.000Z" }),
        coupon({ id: "d", code: "LATER10", expiresAt: "2026-12-31T00:00:00.000Z" }),
      ],
      10,
      { now: NOW },
    );

    expect(offers.map((offer) => offer.code)).toEqual(["LIVE10", "LATER10"]);
  });

  it("shows fewer cards rather than padding the row with invented offers", () => {
    const offers = selectStorefrontOffers([coupon({ id: "a", code: "ONLY10" })], 3, {
      now: NOW,
    });

    expect(offers).toHaveLength(1);
    // The specific failure: a card whose code no coupon backs.
    const demoCodes = specialOffers.map((offer) => offer.code).filter(Boolean);
    expect(demoCodes.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(demoCodes).not.toContain(offer.code);
    }
  });

  it("shows nothing at all when the shop has no live coupon", () => {
    expect(selectStorefrontOffers([], 3, { now: NOW })).toEqual([]);
    expect(
      selectStorefrontOffers([coupon({ id: "a", code: "OFF", isActive: false })], 3, {
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("prints the minimum spend a code needs, so the card matches the checkout", () => {
    // Without this the card reads "₹500 OFF · SAVE500" and a ₹1,200 basket is
    // refused at checkout — the same broken promise, one step later.
    const [withMinimum, without] = selectStorefrontOffers(
      [
        coupon({
          id: "a",
          code: "SAVE500",
          flatOff: 500,
          percentOff: undefined,
          minSubtotal: 5000,
        }),
        coupon({ id: "b", code: "ANY10" }),
      ],
      10,
      { now: NOW, currency: "INR" },
    );

    expect(withMinimum.minSpend).toContain("5,000");
    expect(without.minSpend).toBeUndefined();
  });

  it("prices the badge in the shop's currency, not always rupees", () => {
    const flat = coupon({
      id: "a",
      code: "SAVE500",
      flatOff: 500,
      percentOff: undefined,
    });

    const inr = selectStorefrontOffers([flat], 1, { now: NOW, currency: "INR" })[0];
    const usd = selectStorefrontOffers([flat], 1, { now: NOW, currency: "USD" })[0];

    expect(inr.discount).toContain("₹");
    expect(usd.discount).toContain("$");
    expect(usd.discount).not.toContain("₹");
  });

  it("never invents an expiry date for an open-ended coupon", () => {
    const [offer] = selectStorefrontOffers([coupon({ id: "a", code: "OPEN10" })], 1, {
      now: NOW,
    });
    expect(offer.expiresAt).toBe("");
  });

  it("keeps a live coupon live and an expired one dead", () => {
    expect(isLiveCoupon(coupon({ id: "a", code: "A" }), NOW)).toBe(true);
    expect(isLiveCoupon(coupon({ id: "a", code: "A", isActive: false }), NOW)).toBe(false);
    expect(
      isLiveCoupon(coupon({ id: "a", code: "A", expiresAt: "2026-01-01T00:00:00.000Z" }), NOW),
    ).toBe(false);
  });
});

describe("wedding offers", () => {
  it("does not mistake a Wednesday promotion for a wedding one", () => {
    // `includes("wed")` is a superset of `includes("wedding")`, so a midweek
    // promo outranked the real wedding coupon on the wedding page — the one
    // page where the wedding coupon is what the customer came for.
    expect(
      isWeddingCoupon(
        coupon({
          id: "a",
          code: "WED10",
          label: "Wednesday Wonders",
          description: "Every Wednesday",
        }),
      ),
    ).toBe(false);

    expect(
      isWeddingCoupon(
        coupon({
          id: "b",
          code: "WED2026",
          label: "₹2000 OFF",
          description: "Flat ₹2000 off on wedding cake bookings",
        }),
      ),
    ).toBe(true);
  });

  it("leads with wedding coupons but every card is still a real one", () => {
    const offers = selectWeddingCouponOffers(
      [
        coupon({ id: "a", code: "GEN10" }),
        coupon({ id: "b", code: "W1", description: "wedding package" }),
        coupon({ id: "c", code: "DEAD", isActive: false, description: "wedding" }),
      ],
      5,
      { now: NOW },
    );

    expect(offers.map((offer) => offer.code)).toEqual(["W1", "GEN10"]);
  });

  it("shows nothing rather than demo offers when there are no coupons", () => {
    expect(selectWeddingCouponOffers([], 3, { now: NOW })).toEqual([]);
  });
});

describe("the wedding collection grid", () => {
  function product(over: Partial<LandingProduct> & { slug: string }): LandingProduct {
    return {
      id: over.slug,
      name: over.slug,
      description: "",
      price: 1000,
      image: "https://example.com/cake.jpg",
      category: "Cakes",
      ...over,
    };
  }

  it("shows only cakes the shop actually sells", () => {
    // The grid used to append `weddingCakes` — full links wrapping a photo, a
    // name and a "Starting from ₹15,999" line, pointing at /store/cakes/<slug>.
    // They resolve only because the same demo cakes were seeded into the
    // catalogue; a shop that deletes them keeps advertising them to a 404.
    const cakes = selectWeddingCollectionProducts(
      [
        product({ slug: "our-wedding-tier", category: "Wedding Cakes" }),
        product({ slug: "birthday-thing", category: "Birthday Cakes" }),
      ],
      6,
    );

    expect(cakes.map((cake) => cake.slug)).toEqual(["our-wedding-tier"]);
  });

  it("returns nothing when the shop has no wedding cake", () => {
    const demoSlugs = weddingCakes.map((cake) => cake.slug);
    expect(demoSlugs.length).toBeGreaterThan(0);

    const cakes = selectWeddingCollectionProducts(
      [product({ slug: "birthday-thing", category: "Birthday Cakes" })],
      6,
    );

    expect(cakes).toEqual([]);
    for (const slug of demoSlugs) {
      expect(cakes.map((cake) => cake.slug)).not.toContain(slug);
    }
  });
});
