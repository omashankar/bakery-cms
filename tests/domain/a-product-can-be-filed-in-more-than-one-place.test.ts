import { describe, expect, it } from "vitest";

import { mapAdminProductToStorefront } from "@/features/products/lib/product-mapper";
import { filterProductsByCategory } from "@/features/products/lib/product-catalog";
import { selectHomepageCategories } from "@/features/products/lib/homepage-catalog";
import {
  categoriesOf,
  countByCategory,
  normalizeCommerceFields,
  productsLeftUnfiled,
} from "@/features/products/lib/products-repository";
import type { Product } from "@/types/product";

/**
 * A GIFT HAMPER IS A GIFT AND A CHOCOLATE, AND IT IS ONE PRODUCT.
 *
 * A product could be filed in exactly one category — `categoryId: String` — so
 * a shop selling "Chocolate Truffle Cake With Money Plant" had to choose
 * between Cakes and Plants, or create the product twice and keep two stock
 * counts, two prices and two sets of reviews in step by hand.
 *
 * THIS TEST SPANS BOTH PLACES THE FEATURE CAN DIE IN SILENCE, which is why it
 * is one test and not two:
 *
 *  - `product-mapper` is where the storefront's entire idea of a category is
 *    minted, from one id into one NAME. Its return is a whitelist, and a field
 *    missing from it "persists perfectly and is never seen by a customer".
 *  - `filterProductsByCategory` is what decides which products a category page
 *    shows. It compares that name.
 *
 * Wire only one of the two and everything looks right: the admin saves, the
 * database is correct, the API answers 201, and the category page renders
 * perfectly without the product in it. Nothing logs. A page that should show
 * seven and shows three is indistinguishable from a page that is right.
 *
 * Three things stop this passing for the wrong reason. The category is named
 * "Money Plants" at the slug "plants", so an implementation that slugifies the
 * product's own category name — the comparison this repo has already recorded
 * as broken, "'birthday-cakes' !== 'birthday'" — fails. A control product filed
 * only under Cakes must be absent, so a matcher that returns everything fails.
 * And the same product must still appear under its PRIMARY category, so an
 * implementation that replaces the primary instead of adding to it fails too.
 */

const CATEGORIES = [
  // Deliberately a name that does not slugify to its own slug.
  { name: "Money Plants", slug: "plants" },
  { name: "Celebration Cakes", slug: "cakes" },
];

const NAMES = {
  categories: new Map([
    ["cat-cakes", "Celebration Cakes"],
    ["cat-plants", "Money Plants"],
  ]),
};

function product(overrides: Partial<Product>): Product {
  return {
    id: "p-1",
    name: "Chocolate Truffle Cake With Money Plant",
    slug: "truffle-cake-money-plant",
    description: "A cake and a plant.",
    price: 1299,
    images: ["/combo.jpg"],
    categoryId: "cat-cakes",
    categoryIds: ["cat-cakes"],
    occasionIds: [],
    status: "published",
    stockQuantity: 5,
    stockStatus: "in-stock",
    // Arrays the mapper reads bare. A fixture is not the place to discover
    // that, so they are here rather than defended for in the code.
    flavourOptions: [],
    shapes: [],
    variantGroups: [],
    ...overrides,
  } as Product;
}

describe("a product filed in two categories appears under both", () => {
  const combo = mapAdminProductToStorefront(
    product({ categoryIds: ["cat-cakes", "cat-plants"] }),
    NAMES,
  );
  const cakeOnly = mapAdminProductToStorefront(
    product({ id: "p-2", slug: "plain-cake", name: "Plain Cake" }),
    NAMES,
  );

  it("appears on the page for a category it was added to", () => {
    /**
     * The headline failure. Without this the Plants page renders its heading,
     * its filters and a grid that simply does not contain the product — and
     * the only empty-state message in the page fires when a category has NO
     * products at all, so a short page says nothing.
     */
    expect(filterProductsByCategory([combo, cakeOnly], "plants", CATEGORIES)).toEqual([combo]);
  });

  it("and still appears under the category that owns it", () => {
    // A shape that MOVED the product rather than adding to it would pass the
    // case above and quietly empty the category it came from.
    expect(filterProductsByCategory([combo, cakeOnly], "cakes", CATEGORIES)).toEqual([
      combo,
      cakeOnly,
    ]);
  });

  it("does not sweep in a product that was never filed there", () => {
    // A matcher that returns everything passes the first case on its own.
    expect(filterProductsByCategory([cakeOnly], "plants", CATEGORIES)).toEqual([]);
  });
});

describe("the storefront is told about every category, by name", () => {
  it("resolves each id through the shop's own list", () => {
    /**
     * The mapper's job: the storefront has no concept of a category id, so an
     * id that reaches it unresolved is a product that matches nothing.
     */
    const mapped = mapAdminProductToStorefront(
      product({ categoryIds: ["cat-cakes", "cat-plants"] }),
      NAMES,
    );

    expect(mapped.categories).toEqual(["Celebration Cakes", "Money Plants"]);
    // The primary still stands alone, because the card's overline and the
    // product badge are one name, not a list.
    expect(mapped.category).toBe("Celebration Cakes");
  });

  it("drops an id the shop has since deleted, rather than showing a raw id", () => {
    /**
     * The same asymmetry the mapper already applies to occasions: an
     * unresolvable id is dropped from the array, while an unresolvable primary
     * collapses to "" so no badge renders. A raw `cat-deleted` on a product
     * card is the failure this prevents.
     */
    const mapped = mapAdminProductToStorefront(
      product({ categoryIds: ["cat-cakes", "cat-deleted"] }),
      NAMES,
    );

    expect(mapped.categories).toEqual(["Celebration Cakes"]);
  });
});

describe("a product written before this existed is filed all the same", () => {
  /**
   * `normalizeCommerceFields` is the one chokepoint every product passes
   * through — every server read, and every read of the admin's browser cache.
   * It is where the invariant is established, and the reason nothing
   * downstream needs a fallback.
   *
   * It matters most for documents that predate the field. `.lean()` does not
   * apply Mongoose defaults, so those read back `categoryIds === undefined` —
   * and a careful caller writing `?.includes()` would quietly answer false for
   * the shop's entire existing catalogue, with nothing logged anywhere.
   */
  it("reads back filed under the one category it has", () => {
    const legacy = normalizeCommerceFields(
      product({ categoryIds: undefined as unknown as string[] }),
    );

    expect(legacy.categoryIds).toEqual(["cat-cakes"]);
  });

  it("puts the primary first, and says each category once", () => {
    /**
     * `categoryIds[0] === categoryId` is the invariant the whole shape rests
     * on. A list that drops the primary files a product everywhere except the
     * category that owns its badge.
     */
    const messy = normalizeCommerceFields(
      product({ categoryId: "cat-cakes", categoryIds: ["cat-plants", "cat-cakes", ""] }),
    );

    expect(messy.categoryIds).toEqual(["cat-cakes", "cat-plants"]);
  });
});

describe("the matcher folds case and space, on both sides", () => {
  it("still matches a name the shop has since retyped", () => {
    /**
     * The fold was on the primary comparison before this work and had to
     * survive the move into `.some()`. Without it a category retyped as
     * ' money plants' empties its own page — and the page renders its heading
     * and its filters either way, so nothing looks wrong.
     */
    const scruffy = mapAdminProductToStorefront(
      product({ categoryIds: ["cat-cakes", "cat-plants"] }),
      { categories: new Map([["cat-cakes", "Celebration Cakes"], ["cat-plants", "  money PLANTS "]]) },
    );

    expect(filterProductsByCategory([scruffy], "plants", CATEGORIES)).toEqual([scruffy]);
  });
});
describe("deleting a category only orphans what it leaves filed nowhere", () => {
  /**
   * The only warning attached to a destructive action, and it used to be wrong
   * in the direction that gets warnings ignored.
   *
   * It summed the per-category tallies. Once a product can hold several, that
   * counts a product filed in two of the doomed categories TWICE, and counts a
   * product keeping a category outside the selection as orphaned when it is
   * not. An owner who checks the number once, finds it overstated, and stops
   * reading it is worse off than one who was never warned.
   */
  const cakesOnly = { categoryId: "cat-cakes", categoryIds: ["cat-cakes"] };
  const cakeAndPlant = { categoryId: "cat-cakes", categoryIds: ["cat-cakes", "cat-plants"] };
  const plantOnly = { categoryId: "cat-plants", categoryIds: ["cat-plants"] };
  const shop = [cakesOnly, cakeAndPlant, plantOnly];

  it("spares a product that keeps a category outside the selection", () => {
    // Deleting Cakes leaves the combo filed under Plants. It is not orphaned,
    // and the old sum counted it.
    expect(productsLeftUnfiled(shop, ["cat-cakes"])).toEqual([cakesOnly]);
  });

  it("counts a product filed in two doomed categories once", () => {
    expect(productsLeftUnfiled(shop, ["cat-cakes", "cat-plants"])).toEqual([
      cakesOnly,
      cakeAndPlant,
      plantOnly,
    ]);
  });

  it("leaves a product that was already filed nowhere out of it", () => {
    /**
     * It is in that state whatever happens next, so reporting it as NEWLY
     * orphaned is the same overstatement in a different place.
     */
    const unfiled = { categoryId: "", categoryIds: [] };

    expect(productsLeftUnfiled([...shop, unfiled], ["cat-cakes"])).toEqual([cakesOnly]);
  });

  it("and a product written before memberships existed is read by its primary", () => {
    const legacy = { categoryId: "cat-cakes" };

    expect(categoriesOf(legacy)).toEqual(["cat-cakes"]);
    expect(productsLeftUnfiled([legacy], ["cat-cakes"])).toEqual([legacy]);
  });
});

describe("a category's count matches the page it links to", () => {
  /**
   * Counted over every membership, in both places that show a number.
   *
   * The homepage tile and the admin Catalog row are the two, and they were
   * separate expressions until a product could be in more than one category —
   * at which point counting the primary alone would have put back the lie this
   * repo already fixed once, the other way round. The homepage advertised "48
   * cakes" under Birthday in a shop with 25; the version to avoid now says
   * "Plants · 3" over a page that lists seven, and a customer reads the small
   * number and does not click.
   */
  const shop = [
    { categoryId: "cat-cakes", categoryIds: ["cat-cakes"] },
    { categoryId: "cat-cakes", categoryIds: ["cat-cakes", "cat-plants"] },
    { categoryId: "cat-plants", categoryIds: ["cat-plants"] },
  ];

  it("counts a product in every category it is filed under", () => {
    const tally = countByCategory(shop);

    expect(tally.get("cat-cakes")).toBe(2);
    expect(tally.get("cat-plants")).toBe(2);
  });

  it("so the buckets sum to more than the shop holds, deliberately", () => {
    // Three products, four memberships. Restoring single-counting to "fix"
    // this is the regression.
    const total = [...countByCategory(shop).values()].reduce((a, b) => a + b, 0);

    expect(total).toBe(4);
    expect(shop.length).toBe(3);
  });

  it("and the homepage tile agrees with it", () => {
    /**
     * The customer-visible one. `selectHomepageCategories` builds the tile, and
     * it renders the number beside the category name.
     */
    const tiles = selectHomepageCategories(
      shop.map((cake) => ({ ...cake, status: "published" })),
      [
        { id: "cat-plants", name: "Money Plants", slug: "plants", image: "/p.jpg" },
        { id: "cat-cakes", name: "Celebration Cakes", slug: "cakes", image: "/c.jpg" },
      ],
    );

    expect(tiles.find((tile) => tile.id === "cat-plants")?.count).toBe(2);
  });
});
