import { describe, expect, it, vi } from "vitest";

// The catalog helpers read localStorage; give them a fixed taxonomy so the
// re-derivation can be exercised as arithmetic rather than as a mock.
vi.mock("@/features/catalog/lib/catalog-repository", () => ({
  getCategories: () => [],
  getFlavours: () => [],
  getOccasions: () => [],
  getCategoryById: () => undefined,
  getCategoryByName: () => undefined,
  getFlavourByName: () => undefined,
  getWeightOptions: () => [
    { id: "w1", label: "0.5 kg", modifier: 0, serves: "2-4", sortOrder: 1 },
    { id: "w2", label: "1 kg", modifier: 400, serves: "6-8", sortOrder: 2 },
    { id: "w3", label: "2 kg", modifier: 900, serves: "12-16", sortOrder: 3 },
  ],
}));

const { getDefaultWeights, rederiveWeights } = await import(
  "@/features/products/lib/catalog-options"
);

/**
 * Which sizes a product comes in is the PRODUCT's answer.
 *
 * The Catalog holds the sizes a shop sells and what each adds to a price. That
 * is a taxonomy, not a promise that every product is made in all of them — a
 * ring-ceremony cake sold in 0.5 kg and 1 kg is not sold in 2 kg because the
 * shop also bakes 2 kg birthday cakes.
 *
 * The form could only say all of them or none, and worse, `rederiveWeights`
 * mapped over the whole preset list — so even a shop that deleted a tier by hand
 * got it back on the first keystroke in the Price field, priced and orderable,
 * with nothing on screen to say it had returned.
 */
describe("re-pricing a product after its base price changes", () => {
  const derived = [
    { label: "0.5 kg", price: 1000, serves: "2-4" },
    { label: "1 kg", price: 1400, serves: "6-8" },
    { label: "2 kg", price: 1900, serves: "12-16" },
  ];

  it("leaves a product sold in two sizes sold in two sizes", () => {
    const twoSizes = [derived[0], derived[1]];

    const next = rederiveWeights(twoSizes, 1200, 1000);

    expect(next.map((tier) => tier.label)).toEqual(["0.5 kg", "1 kg"]);
    // …and both re-priced from the new base, because neither was hand-typed.
    expect(next.map((tier) => tier.price)).toEqual([1200, 1600]);
  });

  it("keeps a price the shop typed for one of them", () => {
    const twoSizes = [derived[0], { ...derived[1], price: 1500 }];

    const next = rederiveWeights(twoSizes, 1200, 1000);

    expect(next[0].price).toBe(1200);
    expect(next[1].price).toBe(1500);
  });

  it("keeps a size whose preset the shop has since deleted from Catalog", () => {
    /**
     * There is nothing left to re-derive it from, and dropping it would delete
     * a size the product is genuinely sold in — silently, on a keystroke in a
     * different field.
     */
    const retired = { label: "5 kg", price: 4000, serves: "30+" };

    const next = rederiveWeights([derived[0], retired], 1200, 1000);

    expect(next).toEqual([{ label: "0.5 kg", price: 1200, serves: "2-4" }, retired]);
  });

  it("still says nothing about size for a product sold in one", () => {
    // A phone charger is not sold by the kilo, and this used to hand it three
    // tiers on the first keystroke.
    expect(rederiveWeights([], 1200, 1000)).toEqual([]);
  });
});

describe("what the Catalog is for", () => {
  it("prices every size it holds from a base", () => {
    expect(getDefaultWeights(1000)).toEqual([
      { label: "0.5 kg", price: 1000, serves: "2-4" },
      { label: "1 kg", price: 1400, serves: "6-8" },
      { label: "2 kg", price: 1900, serves: "12-16" },
    ]);
  });

  it("gives the modifier on its own when asked from zero", () => {
    // Which is how the form gets label + surcharge without reading the catalog
    // again on every keystroke in the Price field.
    expect(getDefaultWeights(0).map((tier) => tier.price)).toEqual([0, 400, 900]);
  });
});
