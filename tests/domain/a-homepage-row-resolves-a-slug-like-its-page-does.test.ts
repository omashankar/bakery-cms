import { describe, expect, it } from "vitest";

import { buildCategoryRail } from "@/features/products/lib/homepage-rails";
import type { LandingProduct } from "@/constants/landing-data";

/**
 * A ROW AND THE PAGE IT ADVERTISES HOLD THE SAME PRODUCTS.
 *
 * A homepage row is stored as a SLUG and nothing else — no record of which of
 * the three lists the shop put that slug in. The row resolved it against
 * categories alone while `/store/collections/<slug>` resolves it against all
 * three, so the two could disagree, and did: this shop's catalogue was rebuilt
 * so that a category says what a thing IS, "birthday" became an occasion, and
 * the homepage's Birthday row drew nothing while the page its "View all" opens
 * still held nineteen products.
 *
 * So the row resolves in the same order the page does — collection, then
 * category, then occasion — and these pin that order, including the case where
 * two lists claim one slug.
 */

const cake = (
  slug: string,
  extra: Partial<LandingProduct> = {},
): LandingProduct =>
  ({
    id: `id-${slug}`,
    slug,
    name: slug,
    category: "",
    categories: [],
    occasions: [],
    price: 100,
    image: "",
    description: "",
    ...extra,
  }) as LandingProduct;

const CATEGORIES = [
  { name: "Cream Cakes", slug: "cream-cakes" },
  { name: "Birthday Cakes", slug: "birthday" },
];

describe("a homepage row pointed at a slug", () => {
  it("holds the CATEGORY when a category claims it", () => {
    const filed = cake("filed", { category: "Cream Cakes", categories: ["Cream Cakes"] });
    const tagged = cake("tagged", { occasions: ["Cream Cakes"] });

    const row = buildCategoryRail("cream-cakes", 8, [], [filed, tagged], CATEGORIES);

    expect(row.map((c) => c.slug)).toEqual(["filed"]);
  });

  it("holds the OCCASION when no category claims it", () => {
    /*
      THE ONE THAT WENT SILENT. Nothing is filed under "birthday" as a category
      any more — the rebuild moved those products to the types that describe
      them — and nineteen carry it as an occasion.
    */
    const tagged = cake("tagged", { occasions: ["Birthday"] });
    const other = cake("other", { category: "Cream Cakes" });

    const row = buildCategoryRail("birthday", 8, [], [tagged, other], [
      { name: "Cream Cakes", slug: "cream-cakes" },
    ]);

    expect(row.map((c) => c.slug)).toEqual(["tagged"]);
  });

  it("and the CATEGORY wins when both claim it", () => {
    /*
      A row labelled with a category's name should hold that category. The two
      can share a slug — this shop had "Birthday Cakes" the category and
      "Birthday" the occasion at /birthday for months — and folding them
      together is what made the category impossible to see.
    */
    const filed = cake("filed", { category: "Birthday Cakes", categories: ["Birthday Cakes"] });
    const tagged = cake("tagged", { occasions: ["Birthday"] });

    const row = buildCategoryRail("birthday", 8, [], [filed, tagged], CATEGORIES);

    expect(row.map((c) => c.slug)).toEqual(["filed"]);
  });

  it("holds the COLLECTION first of all, in the order the shop curated", () => {
    /*
      A collection is a LIST somebody wrote, and the order is the content — a
      shop puts its best seller first. So this walks the ids rather than the
      catalogue, which is also what keeps a product that merely shares the name
      out of it.
    */
    const first = cake("first");
    const second = cake("second");
    const outsider = cake("outsider", { category: "Seasonal" });

    const row = buildCategoryRail(
      "seasonal",
      8,
      [],
      [outsider, second, first],
      [{ name: "Seasonal", slug: "seasonal" }],
      [{ slug: "seasonal", productIds: ["id-first", "id-second"] }],
    );

    expect(row.map((c) => c.slug)).toEqual(["first", "second"]);
  });

  it("and falls past an EMPTY collection rather than drawing nothing", () => {
    /*
      A group the shop named and has not filled yet is not an instruction to
      empty the row that was working — the slug may still be a category.
    */
    const filed = cake("filed", { category: "Cream Cakes", categories: ["Cream Cakes"] });

    const row = buildCategoryRail("cream-cakes", 8, [], [filed], CATEGORIES, [
      { slug: "cream-cakes", productIds: [] },
    ]);

    expect(row.map((c) => c.slug)).toEqual(["filed"]);
  });

  it("and answers with nothing when no list claims the slug at all", () => {
    const row = buildCategoryRail("nobody-has-this", 8, [], [cake("a")], CATEGORIES);

    expect(row).toEqual([]);
  });
});
