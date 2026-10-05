import { beforeEach, describe, expect, it } from "vitest";

import { sizeLabelsInUse, usualPriceForSize } from "@/features/products/lib/products-repository";
import { getFilterWeightOptions } from "@/apps/website/lib/collection-filters";
import type { LandingProduct } from "@/constants/landing-data";

/**
 * A shop-wide list of sizes was the wrong shape for a shop that sells more than
 * one kind of thing.
 *
 * Sizes lived in Catalog as a taxonomy — label plus a price modifier — and every
 * product derived its tiers from it. So a cake shop that also sells chargers had
 * "0.5 kg" offered for a charger and nowhere to put a cable length, and a size
 * could sit in Catalog with no product using it while a product was sold in a
 * size Catalog had never heard of.
 *
 * Sizes are typed on the product now. `ProductWeight` has always carried label,
 * price and serves of its own, so nothing had to move — the taxonomy was a
 * second copy of an answer the product already had.
 *
 * THE COST OF THAT, and the reason for the two helpers below: a shop with thirty
 * products should not type "500 gm" thirty times, and two spellings of one size
 * split the storefront filter in two. So the form suggests what this shop has
 * already typed elsewhere. That is a reading of the products, not a list anybody
 * maintains — it cannot go stale, and it disappears on its own when the last
 * product using a size does.
 */

const STORAGE_KEY = "bakery-cms-admin-cakes";

function shopSells(...products: Record<string, unknown>[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      products.map((product, index) => ({
        id: `p-${index}`,
        name: `Product ${index}`,
        slug: `product-${index}`,
        description: "",
        price: 500,
        images: [],
        categoryId: "c1",
        occasionIds: [],
        weights: [],
        status: "published",
        shapes: [],
        flavourOptions: [],
        rating: 0,
        reviewCount: 0,
        seo: {},
        ...product,
      })),
    ),
  );
}

const card = (over: Partial<LandingProduct>): LandingProduct =>
  ({ id: "1", name: "X", slug: "x", description: "", price: 500, image: "", category: "C", ...over }) as LandingProduct;

beforeEach(() => {
  window.localStorage.clear();
});

describe("what the form offers while a size is being typed", () => {
  it("suggests the sizes this shop already uses", () => {
    shopSells(
      { weights: [{ label: "Small", price: 500 }, { label: "Large", price: 900 }] },
      { weights: [{ label: "Small", price: 550 }] },
    );

    /**
     * Commonest first, and the fixture has to be able to SAY so: “Small” is on
     * two products and “Large” on one, and alphabetically they fall the OTHER
     * way round — so a version that sorted by name alone fails here. The first
     * fixture could not tell the two apart, and the mutation walked through it.
     */
    expect(sizeLabelsInUse()).toEqual(["Small", "Large"]);
  });

  it("suggests nothing to a shop that has never sold by size", () => {
    shopSells({ weights: [] }, {});

    expect(sizeLabelsInUse()).toEqual([]);
  });

  it("forgets a size when the last product using it stops", () => {
    /**
     * The whole difference between this and a taxonomy. A list somebody
     * maintains keeps offering a size after nothing is sold in it; a reading of
     * the products cannot.
     */
    shopSells({ weights: [{ label: "2 kg", price: 1800 }] });
    expect(sizeLabelsInUse()).toContain("2 kg");

    shopSells({ weights: [{ label: "1 kg", price: 900 }] });
    expect(sizeLabelsInUse()).not.toContain("2 kg");
  });

  it("ignores a row left without a name", () => {
    shopSells({ weights: [{ label: "  ", price: 100 }, { label: "1 kg", price: 900 }] });

    expect(sizeLabelsInUse()).toEqual(["1 kg"]);
  });
});

describe("what a size usually costs on this shop's other products", () => {
  it("offers the middle price, not an average", () => {
    /**
     * One mispriced product should not drag the suggestion, and a shop with two
     * price points gets one of the two rather than a number nobody charges.
     */
    shopSells(
      { weights: [{ label: "1 kg", price: 900 }] },
      { weights: [{ label: "1 kg", price: 1000 }] },
      { weights: [{ label: "1 kg", price: 9000 }] },
    );

    expect(usualPriceForSize("1 kg")).toBe(1000);
  });

  it("matches the name however it was capitalised", () => {
    shopSells({ weights: [{ label: "1 Kg", price: 900 }] });

    expect(usualPriceForSize("  1 kg ")).toBe(900);
  });

  it("offers nothing for a size nobody sells yet", () => {
    shopSells({ weights: [{ label: "1 kg", price: 900 }] });

    expect(usualPriceForSize("5 kg")).toBeNull();
  });

  it("offers nothing for a blank name", () => {
    shopSells({ weights: [{ label: "1 kg", price: 900 }] });

    expect(usualPriceForSize("   ")).toBeNull();
  });
});

describe("the filter offers what is on the page", () => {
  it("reads the sizes off the products being shown", () => {
    const options = getFilterWeightOptions([
      card({ slug: "a", weights: [{ label: "1 kg", price: 900 }] }),
      card({
        slug: "b",
        weights: [{ label: "1 kg", price: 800 }, { label: "500 gm", price: 500 }],
      }),
    ]);

    expect(options).toEqual(["1 kg", "500 gm"]);
  });

  it("ignores a size row left without a name", () => {
    // A row the shop added and never filled in is not a size anybody can pick.
    expect(
      getFilterWeightOptions([
        card({ slug: "a", weights: [{ label: "  ", price: 100 }, { label: "1 kg", price: 900 }] }),
      ]),
    ).toEqual(["1 kg"]);
  });

    it("offers nothing where nothing is sold by size", () => {
    // A shop selling phone chargers gets no size filter, rather than three
    // bakery labels that would hide its whole catalogue when ticked.
    expect(getFilterWeightOptions([card({ slug: "charger" })])).toEqual([]);
  });
});
