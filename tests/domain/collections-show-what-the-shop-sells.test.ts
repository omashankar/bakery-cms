/**
 * Collections has to be able to show every cake the shop sells.
 *
 * The price slider's ceiling was a constant — 5,000 — and that constant was
 * also the default. So every product above it was filtered out before the
 * customer touched anything, `countActiveFilters` reported no filter active
 * while it happened, and there was no slider position that brought them back:
 * the maximum WAS the thing excluding them.
 *
 * In this shop that is the wedding cakes, at ₹12,499, ₹15,999 and ₹18,999 —
 * so /store/collections/wedding-cakes, a category whose every product is above
 * the cap, rendered "No Cakes found". The dearest things the bakery sells were
 * the ones it could not show.
 */
import { describe, expect, it } from "vitest";

import {
  applyCollectionFilters,
  collectionPriceCeiling,
  COLLECTION_PRICE_FLOOR,
  countActiveFilters,
  defaultCollectionFilters,
} from "@/apps/website/lib/collection-filters";
import type { LandingProduct } from "@/constants/landing-data";

function cake(name: string, price: number): LandingProduct {
  return {
    id: name,
    slug: name,
    name,
    category: "Wedding Cakes",
    description: "",
    image: "",
    price,
    rating: 5,
    inStock: true,
  } as unknown as LandingProduct;
}

// The shop's real wedding cakes, at the prices it really charges.
const WEDDING = [
  cake("Blush Rose Wedding", 12499),
  cake("Royal Tier Elegance", 15999),
  cake("Classic White Cascade", 18999),
];
const EVERYDAY = [cake("Black Forest", 750), cake("Red Velvet", 1200)];

describe("the collections price filter", () => {
  it("shows the dearest cake at its default settings", () => {
    const catalog = [...EVERYDAY, ...WEDDING];
    const filters = defaultCollectionFilters(collectionPriceCeiling(catalog));

    const shown = applyCollectionFilters(catalog, filters);

    expect(
      shown.map((item) => item.name).sort(),
      "products were hidden before the customer touched a filter",
    ).toEqual(catalog.map((item) => item.name).sort());
  });

  it("leaves a category of expensive cakes browsable rather than empty", () => {
    // The whole catalogue sets the ceiling; the category page filters a subset
    // of it. This is the exact shape of /store/collections/wedding-cakes.
    const ceiling = collectionPriceCeiling([...EVERYDAY, ...WEDDING]);

    const shown = applyCollectionFilters(WEDDING, defaultCollectionFilters(ceiling));

    expect(shown).toHaveLength(3);
  });

  it("reaches above the dearest cake, so the top of the slider hides nothing", () => {
    const ceiling = collectionPriceCeiling([...EVERYDAY, ...WEDDING]);

    // The guarantee the filter rests on: at the maximum, `price > priceMax` is
    // false for everything. A ceiling that rounded DOWN would hide the dearest
    // cake again, which is the bug in miniature.
    expect(ceiling).toBeGreaterThanOrEqual(18999);
  });

  it("does not shrink below a usable slider for a shop selling cupcakes", () => {
    expect(collectionPriceCeiling(EVERYDAY)).toBe(COLLECTION_PRICE_FLOOR);
    expect(collectionPriceCeiling([])).toBe(COLLECTION_PRICE_FLOOR);
  });

  it("ignores a price it cannot read instead of collapsing the ceiling", () => {
    const broken = [cake("Mystery", Number.NaN), ...WEDDING];

    expect(collectionPriceCeiling(broken)).toBeGreaterThanOrEqual(18999);
  });

  it("still filters when the customer actually moves the slider", () => {
    const catalog = [...EVERYDAY, ...WEDDING];
    const ceiling = collectionPriceCeiling(catalog);

    const shown = applyCollectionFilters(catalog, {
      ...defaultCollectionFilters(ceiling),
      priceMax: 2000,
    });

    expect(shown.map((item) => item.name).sort()).toEqual(["Black Forest", "Red Velvet"]);
  });

  it("says no filter is active when the slider is at the top", () => {
    const ceiling = collectionPriceCeiling([...EVERYDAY, ...WEDDING]);

    // The badge on the Filters button. Reporting "1" when nothing is excluded
    // is the mirror of the original bug — which reported "0" while excluding
    // three products.
    expect(countActiveFilters(defaultCollectionFilters(ceiling), ceiling)).toBe(0);
    expect(
      countActiveFilters({ ...defaultCollectionFilters(ceiling), priceMax: 2000 }, ceiling),
    ).toBe(1);

    // Between the old constant and the real ceiling. This is the case that
    // tells the two apart: a slider at 8,000 is excluding all three wedding
    // cakes, and a badge counting against 5,000 would report no filter at all —
    // the same silence the original bug had.
    expect(
      countActiveFilters({ ...defaultCollectionFilters(ceiling), priceMax: 8000 }, ceiling),
      "the badge counted against a fixed ceiling, not this shop's",
    ).toBe(1);
  });
});
