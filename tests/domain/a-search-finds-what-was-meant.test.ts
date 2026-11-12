/**
 * A SEARCH FINDS WHAT WAS MEANT.
 *
 * Measured on the shop's own catalogue: "truffle chocolate" and "eggless
 * chocolate" found nothing, "redvelvet", "blackforest" and "butter scotch"
 * found nothing, "choclate" found nothing, and "chocolate cake" put a baby
 * shower cake first because the phrase was in its description. The header's
 * dropdown and the results page behind Enter answered the same way, because
 * they share one predicate — which still has to hold.
 */
import { describe, expect, it } from "vitest";

import type { LandingProduct } from "@/constants/landing-data";
import { suggestProducts } from "@/features/products/lib/product-suggestions";
import { searchProducts } from "@/features/products/lib/product-catalog";
import {
  applyCollectionFilters,
  collectionPriceCeiling,
  defaultCollectionFilters,
} from "@/apps/website/lib/collection-filters";

let id = 0;
const product = (name: string, extra: Partial<LandingProduct> = {}): LandingProduct => ({
  id: String(++id),
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  description: "",
  price: 500,
  image: "",
  category: "Cakes",
  rating: 4,
  reviewCount: 1,
  ...extra,
});

const CATALOGUE = [
  product("Belgian Chocolate Truffle Pastry", { category: "Pastries" }),
  product("Dark Chocolate Mousse Pastry", { category: "Pastries", optionLabels: ["Eggless"] }),
  product("Elegant Red Velvet Birthday Cake"),
  product("Decadent Black Forest Cherry Cake"),
  product("Caramel Butterscotch Crunch Pastry", { category: "Pastries" }),
  product("Dreamy Welcome Baby Moon Cake", { description: "A soft chocolate cake for a new arrival", rating: 5 }),
  product("Luxurious Chocolate Engagement Cake", { rating: 3 }),
  product("Strawberry Cream Layer Pastry", { category: "Pastries" }),
];

const names = (list: { name: string }[]) => list.map((p) => p.name);
const suggest = (q: string) => names(suggestProducts(q, CATALOGUE));
const results = (q: string, sort?: "relevance" | "popular") => {
  const filters = { ...defaultCollectionFilters(collectionPriceCeiling(CATALOGUE)), search: q };
  return names(applyCollectionFilters(CATALOGUE, sort ? { ...filters, sort } : filters));
};

describe("every word counts, in any order", () => {
  it.each([
    ["truffle chocolate", "Belgian Chocolate Truffle Pastry"],
    ["eggless chocolate", "Dark Chocolate Mousse Pastry"],
    ["pastry chocolate dark", "Dark Chocolate Mousse Pastry"],
  ])("%s finds %s", (q, wanted) => {
    expect(suggest(q)).toContain(wanted);
    expect(results(q)).toContain(wanted);
  });
});

describe("with or without the space", () => {
  it.each([
    ["redvelvet", "Elegant Red Velvet Birthday Cake"],
    ["blackforest", "Decadent Black Forest Cherry Cake"],
    ["butter scotch", "Caramel Butterscotch Crunch Pastry"],
  ])("%s finds %s", (q, wanted) => {
    expect(suggest(q)).toContain(wanted);
    expect(results(q)).toContain(wanted);
  });
});

describe("a slip of the finger", () => {
  it("still finds the chocolate, the cake named for it first", () => {
    expect(suggest("choclate")[0]).toMatch(/Chocolate/);
    expect(results("choclate")).toContain("Belgian Chocolate Truffle Pastry");
  });

  it("is not forgiven while what was typed matches as it is", () => {
    // "cream" is one letter from "dream"; the cream pastry is what was meant.
    expect(suggest("cream")).toEqual(["Strawberry Cream Layer Pastry"]);
  });

  it("is not stretched to a word too short to tell apart", () => {
    expect(suggest("kek")).toEqual([]);
  });
});

describe("the name outranks the description", () => {
  it("puts a cake named for chocolate ahead of one that mentions it", () => {
    const list = suggest("chocolate cake");
    expect(list[0]).toBe("Luxurious Chocolate Engagement Cake");
    expect(list.indexOf("Dreamy Welcome Baby Moon Cake")).toBeGreaterThan(0);
  });

  it("and the results page, searched, orders by the best match — not by rating", () => {
    expect(results("chocolate cake", "relevance")[0]).toBe("Luxurious Chocolate Engagement Cake");
    // By rating, the five-star baby cake comes first; that is what "Popular" means.
    expect(results("chocolate cake", "popular")[0]).toBe("Dreamy Welcome Baby Moon Cake");
  });
});

describe("the dropdown never offers what Enter cannot find", () => {
  it.each(["choc", "truffle chocolate", "redvelvet", "choclate", "pastry", "cake", "eggless"])("%s", (q) => {
    const found = results(q);
    expect(suggest(q).filter((name) => !found.includes(name))).toEqual([]);
    expect(names(searchProducts(q, CATALOGUE)).sort()).toEqual([...found].sort());
  });
});
