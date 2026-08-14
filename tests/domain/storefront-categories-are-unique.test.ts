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

  it("still falls back to the demo list when the catalogue cannot be read", async () => {
    // A storefront with no way to browse by category is worse than one browsing
    // by the wrong names — and a read that THREW is not an empty catalogue.
    getCatalog.mockRejectedValue(new Error("down"));

    const categories = await (await load())();

    expect(categories.length).toBeGreaterThan(0);
  });

  it("does not fall back when the shop genuinely has one category", async () => {
    getCatalog.mockResolvedValue({ categories: [{ id: "a", name: "Cakes", slug: "cakes" }] });

    const categories = await (await load())();

    expect(categories).toEqual([{ id: "a", name: "Cakes", slug: "cakes" }]);
  });
});
