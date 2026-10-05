import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildDefaultCoupons } from "@/features/commerce/lib/coupons-repository";
import { seedProducts } from "@/features/products/lib/products-repository";

/**
 * What a shop is allowed to say on the day it opens.
 *
 * The demo content is there so a new shop is not an empty screen. It had grown
 * into a set of claims the shop had not earned and could not have earned,
 * because there were no customers yet:
 *
 *   - every product over Rs 1000 carried `compareAtPrice = price * 1.1`, so it
 *     wore a permanent "9% OFF" against a price nobody was ever charged
 *   - every product carried 4.5 stars and "12 reviews" with no review behind it
 *   - the first time anyone opened Reviews, invented reviews under invented
 *     names at @demo.com addresses were written into the real database
 *   - the demo coupons seeded ACTIVE with no expiry, and `getCoupons` is what
 *     `priceCart` resolves a typed code against — so anyone who guessed BDAY20
 *     took 20% off a live checkout on a shop that had only just been set up
 *
 * The first three are dishonest. The fourth is money.
 */
describe("the demo catalogue", () => {
  const seeded = seedProducts();

  it("invents no compare-at price", () => {
    // The tell was arithmetic: exactly 10% above the price, on everything above
    // Rs 1000. A struck-through number is a claim about what the shop used to
    // charge, and only the shop can make it.
    const invented = seeded.filter(
      (product) =>
        product.compareAtPrice != null &&
        product.compareAtPrice === Math.round(product.price * 1.1),
    );

    expect(invented.map((product) => product.name)).toEqual([]);
  });

  it("opens every product at zero stars and zero reviews", () => {
    for (const product of seeded) {
      expect(product.rating ?? 0, product.name).toBe(0);
      expect(product.reviewCount ?? 0, product.name).toBe(0);
    }
  });

  it("still ships products, so the checks above are not vacuous", () => {
    expect(seeded.length).toBeGreaterThan(10);
    // A genuinely authored compare-at in the demo data is fine and must survive:
    // the rule is "not invented", not "never present".
    expect(seeded.some((product) => product.price > 1000)).toBe(true);
  });
});

describe("the demo coupons", () => {
  const coupons = buildDefaultCoupons();

  it("are switched off, so no guessed code takes money", () => {
    // These are real rows in Mongo that `priceCart` will resolve. Inactive
    // makes them examples an owner turns on when the owner means them.
    expect(coupons.filter((coupon) => coupon.isActive).map((coupon) => coupon.code)).toEqual([]);
  });

  it("claim no redemptions that never happened", () => {
    // BDAY20 shipped saying it had been used 12 times.
    for (const coupon of coupons) {
      expect(coupon.usageCount, coupon.code).toBe(0);
    }
  });

  it("still ships codes, so the checks above are not vacuous", () => {
    expect(coupons.length).toBeGreaterThan(2);
  });
});

describe("reviews", () => {
  it("are never invented", () => {
    /**
     * Asserted on the source because the seed is gone rather than disabled:
     * there is no function left to call. The invented names went with it — a
     * shop cannot tell which of its reviews are real once they share a
     * collection, so leaving them behind a flag would have been leaving the
     * loaded gun in the drawer.
     */
    const source = readFileSync("features/reviews/server/review.service.ts", "utf8");
    // Comments stripped first. The docblock that replaced the seed NAMES what it
    // removed — "Priya Sharma", "@demo.com" — which is the point of it, and a
    // raw substring check went red on the explanation rather than the code.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toContain("SAMPLE_AUTHORS");
    expect(code).not.toContain("seedReviewsFromProducts");
    expect(code).not.toContain("@demo.com");
  });
});
