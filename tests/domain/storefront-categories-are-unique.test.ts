import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two categories sharing a slug are one link, not two.
 *
 * The category list is admin-typed and nothing stops two rows sharing a slug —
 * the running shop has two called "Seasonal". Every consumer renders one link
 * per row keyed by its href, so a duplicate produces two identical links to the
 * same page and React's "Encountered two children with the same key" warning,
 * whose documented behaviour is that children may be "duplicated and/or
 * omitted".
 *
 * The collections page had already learned this and de-duped its own pills.
 * Feeding the same raw list to the header's Shop menu reproduced the bug there,
 * which is why the de-duplication now lives at the source rather than in each
 * consumer.
 */

const getCatalog = vi.fn();

vi.mock("@/features/catalog/server/catalog.service", () => ({
  getCatalog: () => getCatalog(),
}));

beforeEach(() => {
  vi.resetModules();
  getCatalog.mockReset();
});

const load = async () => {
  const mod = await import("@/apps/website/lib/storefront-categories.server");
  return mod.getStorefrontCategories;
};

describe("the shop's categories", () => {
  it("collapses two rows that share a slug", async () => {
    getCatalog.mockResolvedValue({
      categories: [
        { id: "a", name: "Seasonal", slug: "seasonal" },
        { id: "b", name: "Seasonal", slug: "seasonal" },
        { id: "c", name: "Chocolate", slug: "chocolate" },
      ],
    });

    const categories = await (await load())();

    expect(categories.map((category) => category.slug)).toEqual(["seasonal", "chocolate"]);
  });

  it("keeps the first of the pair, so the visible name does not shuffle", async () => {
    getCatalog.mockResolvedValue({
      categories: [
        { id: "a", name: "Seasonal Specials", slug: "seasonal" },
        { id: "b", name: "Seasonal", slug: "seasonal" },
      ],
    });

    const categories = await (await load())();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe("Seasonal Specials");
  });

  it("drops a row with no slug, which nothing could link to", async () => {
    getCatalog.mockResolvedValue({
      categories: [
        { id: "a", name: "Unnamed", slug: "" },
        { id: "b", name: "Chocolate", slug: "chocolate" },
      ],
    });

    const categories = await (await load())();

    expect(categories.map((category) => category.slug)).toEqual(["chocolate"]);
  });

  it("offers nothing of anyone else's when the catalogue cannot be read", async () => {
    /**
     * THIS USED TO ASSERT THE OPPOSITE, on the argument that a storefront with
     * no way to browse by category is worse than one browsing by the wrong
     * names. The wrong names were the shipped demo taxonomy — Birthday Cakes,
     * Photo Cakes, Eggless Cakes, Seasonal — so a florist whose database was
     * unreachable, or who simply had not added a category yet, got nine cake
     * pages in the header of every page, each linking to an empty grid.
     *
     * Empty is not nothing: `useFallbackCategories` in mega-menu.tsx draws one
     * row built from the shop's OWN product noun, pointing at the collections
     * page, which renders whatever the shop has. That code was written for
     * this case and could never run while the server filled the list first.
     */
    getCatalog.mockRejectedValue(new Error("down"));

    expect(await (await load())()).toEqual([]);
  });

  it("and offers nothing when the shop simply has none yet", async () => {
    // The commoner of the two, and the one a brand-new shop of any trade is in
    // for as long as it takes to add a category.
    getCatalog.mockResolvedValue({ categories: [] });

    expect(await (await load())()).toEqual([]);
  });

  it("does not fall back when the shop genuinely has one category", async () => {
    getCatalog.mockResolvedValue({ categories: [{ id: "a", name: "Cakes", slug: "cakes" }] });

    const categories = await (await load())();

    expect(categories).toEqual([{ id: "a", name: "Cakes", slug: "cakes" }]);
  });
});
