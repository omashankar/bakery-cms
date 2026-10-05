import { describe, expect, it } from "vitest";

import { displayCompareAtPrice } from "@/features/products/lib/product-pricing";

/**
 * The struck-through price is a claim, and it has to hold for the thing being
 * bought — not for the base the shop happened to type in.
 *
 * `compareAtPrice` is ONE number on the product. The price beside it moves with
 * the size and with every option. So a Rs 800 cake with a Rs 1,000 compare-at
 * showed "20% OFF" at half a kilo; pick a kilo and `compareAtPrice > price`
 * stopped being true, and the strike and the badge SILENTLY VANISHED — at
 * exactly the sizes a shop most wants to sell. At a kilo and a half the cake
 * cost more than its own stated compare-at, with nothing shown at all.
 */
describe("what gets struck through", () => {
  const BASE = 800;
  const COMPARE = 1000;

  it("keeps the saving the shop actually offered", () => {
    // Rs 200 at the base, and Rs 200 at every size and option above it.
    expect(displayCompareAtPrice(BASE, COMPARE, 800)).toBe(1000);
    expect(displayCompareAtPrice(BASE, COMPARE, 950)).toBe(1150);
    expect(displayCompareAtPrice(BASE, COMPARE, 1600)).toBe(1800);
  });

  it("still shows a discount at a size that used to lose it", () => {
    /**
     * The regression, stated as a number. At Rs 1,200 the old code compared
     * against the unmoved Rs 1,000 — `compareAtPrice > price` is false — and
     * rendered no strike and no badge at all.
     */
    const moved = displayCompareAtPrice(BASE, COMPARE, 1200);

    expect(moved).toBeDefined();
    expect(moved!).toBeGreaterThan(1200);
  });

  it("lets the percentage fall rather than inventing a bigger discount", () => {
    /**
     * A shop states one saving — "normally 1,000, yours for 800" — and that is
     * a RUPEE amount. Scaling it would claim a larger discount at every larger
     * size than the shop ever agreed to, so the delta is held and the
     * percentage falls. That is also what the reference storefront does:
     * 32% → 28% → 27% → 24% as options are added.
     */
    const percentAt = (price: number) => {
      const compare = displayCompareAtPrice(BASE, COMPARE, price)!;
      return Math.round(((compare - price) / compare) * 100);
    };

    expect(percentAt(800)).toBe(20);
    expect(percentAt(1600)).toBeLessThan(20);
    // …and never rises, which would be the invented direction.
    expect(percentAt(2400)).toBeLessThan(percentAt(1600));
  });

  it("says nothing where there is nothing to say", () => {
    expect(displayCompareAtPrice(BASE, undefined, 800)).toBeUndefined();
  });

  it("refuses a compare-at that is not above the price", () => {
    /**
     * Not hypothetical: this shop has three products priced Rs 999 with a
     * Rs 849 "compare-at" — the strike-through BELOW the selling price, which
     * would read as a price rise. Shifting it upward by the option surcharge
     * would eventually lift it past the price and turn that mistake into a
     * discount badge.
     */
    expect(displayCompareAtPrice(999, 849, 999)).toBeUndefined();
    expect(displayCompareAtPrice(999, 849, 1500)).toBeUndefined();
    // Equal is not a discount either.
    expect(displayCompareAtPrice(800, 800, 800)).toBeUndefined();
  });
});
