import { describe, expect, it } from "vitest";

import { specialOffers, type LandingProduct } from "@/constants/landing-data";
import {
  isLiveCoupon,
  selectStorefrontOffers,
} from "@/features/commerce/lib/coupon-offers";
import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";

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

  it("does not print the discount twice when the label just repeats it", () => {
    // Seen on the live homepage: badge "₹2,000 OFF" above a title "₹2000 OFF".
    // The badge is built with formatCurrency, so a plain string comparison let a
    // single thousands separator through.
    const [flat] = selectStorefrontOffers(
      [
        coupon({
          id: "a",
          code: "WED2026",
          label: "₹2000 OFF",
          flatOff: 2000,
          percentOff: undefined,
        }),
      ],
      1,
      { now: NOW, currency: "INR" },
    );

    expect(flat.discount).toBe("₹2,000 OFF");
    expect(flat.title).toBe("");
  });

  it("keeps a label that says something the badge does not", () => {
    const [named] = selectStorefrontOffers(
      [coupon({ id: "a", code: "BDAY20", label: "Birthday Special", percentOff: 20 })],
      1,
      { now: NOW },
    );

    expect(named.title).toBe("Birthday Special");
    expect(named.discount).toBe("20% OFF");
  });

  it("survives a currency the shop's settings should never have held", () => {
    // `formatCurrency` resolves with `??`, so an empty string or a legacy value
    // reaches Intl.NumberFormat and throws RangeError — inside an async server
    // component, which would take the whole homepage down for every visitor.
    const flat = coupon({
      id: "a",
      code: "SAVE500",
      flatOff: 500,
      percentOff: undefined,
      minSubtotal: 5000,
    });

    for (const currency of ["", "  ", "rupees", "INRR", "12", "₹"]) {
      const run = () => selectStorefrontOffers([flat], 1, { now: NOW, currency });
      expect(run, `currency=${JSON.stringify(currency)}`).not.toThrow();
      const [offer] = run();
      expect(offer.discount).toContain("OFF");
      expect(offer.minSpend).toBeTruthy();
    }
  });

  it("accepts a lowercase or padded currency code", () => {
    const flat = coupon({ id: "a", code: "S", flatOff: 500, percentOff: undefined });

    expect(
      selectStorefrontOffers([flat], 1, { now: NOW, currency: " usd " })[0].discount,
    ).toContain("$");
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


