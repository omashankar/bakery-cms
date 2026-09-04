import { describe, expect, it } from "vitest";

/*
  No catalog mock any more, and nothing to mock: `rederiveWeights` reads only
  the product handed to it. The mocked taxonomy this file used to stand up was
  the whole reason its arithmetic needed explaining.
*/
import { rederiveWeights } from "@/features/products/lib/catalog-options";

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

  it("moves a price the shop typed by the same amount", () => {
    /**
     * The old rule pinned a hand-typed price for ever, because it could tell
     * “typed” from “derived” by comparing against the Catalog presets. There
     * are no presets now, and pinning would be the wrong default anyway: a
     * shop that priced 1 kg at ₹200 over the small one meant ₹200 over, not
     * ₹1,400 for ever. A size that should not move is one field away.
     */
    const twoSizes = [derived[0], { ...derived[1], price: 1500 }];

    const next = rederiveWeights(twoSizes, 1200, 1000);

    expect(next.map((tier) => tier.price)).toEqual([1200, 1700]);
  });

  it("knows nothing about Catalog, and moves every size alike", () => {
    /**
     * There is no taxonomy left to recognise a size by. A label this shop has
     * never used anywhere else is re-priced exactly like one it uses on thirty
     * products, because the only input is the product in front of it.
     */
    const oddOne = { label: "5 kg", price: 4000, serves: "30+" };

    const next = rederiveWeights([derived[0], oddOne], 1200, 1000);

    expect(next).toEqual([
      { label: "0.5 kg", price: 1200, serves: "2-4" },
      { label: "5 kg", price: 4200, serves: "30+" },
    ]);
  });

  it("never prices a size below nothing", () => {
    // A base price cut by more than a size costs would otherwise price it
    // negative — money off for choosing the bigger one.
    const next = rederiveWeights([{ label: "0.5 kg", price: 100 }], 200, 1000);

    expect(next[0].price).toBe(0);
  });

  it("still says nothing about size for a product sold in one", () => {
    // A phone charger is not sold by the kilo, and this used to hand it three
    // tiers on the first keystroke.
    expect(rederiveWeights([], 1200, 1000)).toEqual([]);
  });
});
