/**
 * THE OWNER'S OWN SCREENS HAVE TO AGREE WITH THE BOX THEY TICKED.
 *
 * `a-product-can-be-filed-in-more-than-one-place` covers the customer half —
 * the category page, the mapper, the homepage count. This is the other half,
 * and it is the one that costs an owner an afternoon rather than a sale.
 *
 * Three admin surfaces reduced a product to `categoryId`, its PRIMARY category,
 * and each of them fails in a way that looks like nothing happened:
 *
 *  - The products list's category filter compared `cake.categoryId === id`.
 *    The shop ticks "also show it under Plants", goes to the list, filters by
 *    Plants — and its own cake is not there. The storefront shows it. The admin
 *    does not. There is no error, and nothing to search for.
 *  - The same list's search box built its haystack from the primary's name, so
 *    typing the category just added found nothing.
 *  - Inventory and the command palette matched the primary's name too, which is
 *    the same miss on the two screens an owner actually lives in.
 *
 * Every assertion here is about a product whose PRIMARY is Cakes and which is
 * ALSO filed under Plants, searched or filtered by Plants. A control filed only
 * under Cakes must stay out, so an implementation that gives up and returns
 * everything fails rather than passes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/types/product";
import type { InventoryItem } from "@/types/inventory";
import { defaultProductListFilters } from "@/features/products/lib/product-utils";

/**
 * Named so neither can be recovered from the other. "Money Plants" does not
 * slugify to "plants" and "Celebration Cakes" does not slugify to "cakes", so
 * a match that guesses the name from the id fails here.
 */
const CATEGORIES = [
  { id: "cat-cakes", name: "Celebration Cakes", slug: "cakes" },
  { id: "cat-plants", name: "Money Plants", slug: "plants" },
];

vi.mock("@/features/products/lib/catalog-options", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, adminCategories: () => CATEGORIES };
});

const stored = vi.hoisted(() => ({ products: [] as Product[] }));

vi.mock("@/features/products/lib/products-repository", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, loadProducts: () => stored.products };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/admin/cakes",
}));

const { filterProducts } = await import(
  "@/apps/admin/products/components/products-list-page"
);
const { getInventoryItems, filterInventoryItems } = await import(
  "@/apps/admin/commerce/lib/inventory-repository"
);
const { searchAdminGlobal } = await import("@/apps/admin/lib/global-search");

function product(overrides: Partial<Product>): Product {
  return {
    id: "p-1",
    name: "Truffle Cake",
    slug: "truffle-cake",
    description: "",
    price: 999,
    images: [],
    categoryId: "cat-cakes",
    categoryIds: ["cat-cakes"],
    occasionIds: [],
    weights: [],
    status: "published",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    shapes: [],
    flavourOptions: [],
    stockStatus: "in_stock",
    stockQuantity: 5,
    unlimitedStock: false,
    allowsMessage: false,
    allowsPhotoUpload: false,
    variantGroups: [],
    rating: 0,
    reviewCount: 0,
    seo: { metaTitle: "", metaDescription: "" },
    createdAt: "",
    updatedAt: "",
    ...overrides,
  } as Product;
}

/** Primary Cakes, also filed under Plants. The one every miss loses. */
const HAMPER = product({
  id: "p-hamper",
  name: "Truffle Cake With Money Plant",
  slug: "truffle-cake-with-money-plant",
  categoryId: "cat-cakes",
  categoryIds: ["cat-cakes", "cat-plants"],
});

/** Filed under Cakes and nowhere else. Must never come back for Plants. */
const PLAIN = product({
  id: "p-plain",
  name: "Plain Truffle Cake",
  slug: "plain-truffle-cake",
  categoryId: "cat-cakes",
  categoryIds: ["cat-cakes"],
});

const idsOf = (list: { id: string }[]) => list.map((item) => item.id).sort();

beforeEach(() => {
  stored.products = [HAMPER, PLAIN];
});

describe("the products list finds a product by a category it was added to", () => {
  it("filters by membership, not by the primary alone", () => {
    const found = filterProducts([HAMPER, PLAIN], {
      ...defaultProductListFilters,
      categoryId: "cat-plants",
    });

    expect(idsOf(found), "the cake also filed under Plants was not listed").toEqual([
      "p-hamper",
    ]);
  });

  it("and still lists it under the category that owns it", () => {
    /**
     * The other direction. A filter that swapped equality for "matches any
     * secondary" would pass the test above and drop every product from its own
     * primary category's view.
     */
    const found = filterProducts([HAMPER, PLAIN], {
      ...defaultProductListFilters,
      categoryId: "cat-cakes",
    });

    expect(idsOf(found)).toEqual(["p-hamper", "p-plain"]);
  });

  it("searches every category name it is filed under", () => {
    const found = filterProducts([HAMPER, PLAIN], {
      ...defaultProductListFilters,
      // The CATEGORY's name, not a word in the product's own name — "money"
      // appears in both, "plants" only in the category.
      search: "plants",
    });

    expect(idsOf(found), "searching a secondary category found nothing").toEqual([
      "p-hamper",
    ]);
  });

  it("and does not turn the search box into a pass-through", () => {
    expect(
      filterProducts([HAMPER, PLAIN], {
        ...defaultProductListFilters,
        search: "chocolate ganache",
      }),
    ).toEqual([]);
  });
});

describe("inventory prints one category and searches all of them", () => {
  function itemsByQuery(search: string): InventoryItem[] {
    return filterInventoryItems(getInventoryItems(), {
      search,
      status: "all",
      stock: "all",
    });
  }

  it("finds stock by a category the product was added to", () => {
    expect(idsOf(itemsByQuery("plants").map((item) => ({ id: item.cakeId })))).toEqual([
      "p-hamper",
    ]);
  });

  it("still finds it by its primary", () => {
    expect(
      idsOf(itemsByQuery("celebration").map((item) => ({ id: item.cakeId }))),
    ).toEqual(["p-hamper", "p-plain"]);
  });

  it("shows the primary in the column, deliberately, and the rest only to search", () => {
    /**
     * This is a DELIBERATE narrowing, recorded so a later reader does not
     * "fix" it: the inventory row is one line on a phone and the stock count
     * belongs to the product, not to any one category it sits in. The full
     * list is on the product preview screen.
     */
    const hamper = getInventoryItems().find((item) => item.cakeId === "p-hamper");

    expect(hamper?.categoryName).toBe("Celebration Cakes");
    expect(hamper?.categoryNames).toEqual(["Celebration Cakes", "Money Plants"]);
  });

  it("says a category it cannot name is not a category", () => {
    /**
     * A category the shop has since deleted leaves its id behind on the
     * product. Printing the raw id in a search haystack would let an owner
     * "find" stock by typing a uuid, and printing it in the column would show
     * one. Dropped on both sides — same rule as the storefront mapper.
     */
    stored.products = [
      product({ id: "p-ghost", categoryId: "cat-cakes", categoryIds: ["cat-cakes", "cat-gone"] }),
    ];
    const ghost = getInventoryItems()[0];

    expect(ghost.categoryNames).toEqual(["Celebration Cakes"]);
    expect(itemsByQuery("cat-gone")).toEqual([]);
  });

  it("and a product filed under nothing nameable still shows a placeholder", () => {
    stored.products = [product({ id: "p-orphan", categoryId: "cat-gone", categoryIds: ["cat-gone"] })];

    expect(getInventoryItems()[0].categoryName).toBe("—");
  });
});

describe("the command palette reaches stock by any of its categories", () => {
  /**
   * The palette is the one search an owner uses from every screen in the admin,
   * and its inventory rows share `getInventoryItems` with the screen above. The
   * group filter keeps this to the inventory rows, so a PRODUCT row matching on
   * the cake's own name cannot make it pass for the wrong reason.
   */
  const LABELS = { productWord: "Product", productWordPlural: "Products" };

  it("finds it by a secondary category name", () => {
    const found = searchAdminGlobal("plants", LABELS, { groupFilter: "inventory" });

    expect(found.map((row) => row.id)).toEqual(["inventory-p-hamper"]);
  });

  it("and does not answer everything", () => {
    expect(
      searchAdminGlobal("chocolate ganache", LABELS, { groupFilter: "inventory" }),
    ).toEqual([]);
  });
});
