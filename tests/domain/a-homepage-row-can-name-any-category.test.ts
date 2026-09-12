/**
 * A SHOP CAN PUT A ROW OF ITS OWN THINGS ON ITS OWN HOMEPAGE.
 *
 * `HomepageProductSource` is six fixed values, and three of them are bakery
 * category slugs written as string literals: photo-cakes, eggless, seasonal.
 * The homepage builder could add, remove, reorder, hide, schedule and version
 * sections — and could not name one after a category the shop invented.
 *
 * So a plant shop opened Add Section and was offered "Eggless Cakes" and
 * "Photo Cakes", two rows it can never fill, and had no way at all to add
 * "Succulents". The builder was not the limitation; the closed union was.
 *
 * The union STAYS — layouts already published carry those values, and a shop
 * running an Eggless row keeps it. What is added is an open row beside it, and
 * these cases are about the three ways an open row differs from a frozen one:
 *
 *  1. The rail is built for EVERY category the shop has, not for three names.
 *  2. The legacy rows go through the SAME builder, so there is one answer to
 *     "what is in this category" rather than two that can drift.
 *  3. A category rail is never padded. "Succulents" topped up with a cake is a
 *     false statement about the row — the same reason the three named sources
 *     were already exempt from the top-up.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildCategoryRail } from "@/features/products/lib/homepage-rails";
import { resolveRegistryEntry, getRegistryEntry } from "@/constants/section-registry";
import type { LandingProduct } from "@/constants/landing-data";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/** Comments quoting the old shape are not the old shape. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function card(slug: string, category: string): LandingProduct {
  return {
    id: slug,
    name: slug,
    slug,
    price: 100,
    image: "",
    category,
    categories: [category],
  } as LandingProduct;
}

/** A shop that sells plants and cake, with a category whose NAME is not its slug. */
const CATEGORIES = [
  { name: "Money Plants", slug: "succulents" },
  { name: "Celebration Cakes", slug: "cakes" },
];

const CATALOG = [
  card("monstera", "Money Plants"),
  card("aloe", "Money Plants"),
  card("truffle", "Celebration Cakes"),
];

describe("a row named after a category the shop invented", () => {
  it("holds that category's products and nothing else", () => {
    const row = buildCategoryRail("succulents", 8, CATALOG, CATALOG, CATEGORIES);

    expect(row.map((item) => item.slug)).toEqual(["monstera", "aloe"]);
  });

  it("resolves the SLUG through the shop's own list, not by slugifying a name", () => {
    /**
     * "Money Plants" lives at /succulents. A matcher that slugifies the
     * product's category name compares "money-plants" with "succulents" and
     * returns nothing — the exact bug the eggless row had, where "Eggless
     * Cakes" at /eggless came back empty and Seasonal worked only because its
     * name happened to equal its slug.
     */
    expect(buildCategoryRail("succulents", 8, CATALOG, CATALOG, CATEGORIES)).toHaveLength(2);
    // Without the list there is nothing to resolve the slug through, so the
    // row is empty rather than wrong.
    expect(buildCategoryRail("succulents", 8, CATALOG, CATALOG)).toHaveLength(0);
  });

  it("is NEVER padded out with whatever else is in stock", () => {
    /**
     * The whole point. A row that names what its products ARE cannot be topped
     * up: "Succulents" with a cake in it is a false statement about the row,
     * and the customer clicks through to a page that does not have it.
     *
     * Asked for eight and given a catalogue of three, it must return two.
     */
    const row = buildCategoryRail("succulents", 8, CATALOG, CATALOG, CATEGORIES);

    expect(row).toHaveLength(2);
    expect(row.map((item) => item.slug)).not.toContain("truffle");
  });

  it("returns an empty row for a category that no longer exists", () => {
    // A shop deletes a category the homepage still names. Empty is the honest
    // answer; anything else is the row inventing a replacement.
    expect(buildCategoryRail("gone", 8, CATALOG, CATALOG, CATEGORIES)).toEqual([]);
  });

  it("honours the count it was asked for", () => {
    expect(buildCategoryRail("succulents", 1, CATALOG, CATALOG, CATEGORIES)).toHaveLength(1);
  });
});

describe("the frozen bakery rows go through the same builder", () => {
  it("eggless and seasonal call it rather than repeating it", () => {
    /**
     * Two implementations of "what is in this category" is how the eggless row
     * and /collections/eggless came to disagree in the first place. One
     * function, called from both.
     */
    const rails = code("features/products/lib/homepage-rails.ts");

    expect(rails).toContain('eggless: () => buildCategoryRail("eggless"');
    expect(rails).toContain('seasonal: () => buildCategoryRail("seasonal"');
  });

  it("and the closed union is still there for layouts already published", () => {
    /**
     * Deleting those values would swallow a row a shop has configured: the
     * stored layout carries `type: "eggless"`, and the renderer's
     * `default: return null` turns an unknown type into a silently shorter
     * homepage. That has happened here once already.
     */
    const rails = code("features/products/lib/homepage-rails.ts");

    for (const legacy of ["photo-cakes", "eggless", "seasonal"]) {
      expect(rails, `${legacy} was dropped from the union`).toContain(`"${legacy}"`);
    }
  });
});

describe("the builder offers the shop's own categories", () => {
  it("fills the category dropdown from the list it is given", () => {
    /**
     * The registry is plain data and cannot read a catalogue — which is exactly
     * why every category row in it is a hardcoded bakery slug. The field asks
     * to be filled, and whoever CAN read the catalogue fills it.
     */
    const entry = getRegistryEntry("category-rail");
    expect(entry, "the open row is not in the registry").toBeDefined();

    const resolved = resolveRegistryEntry(
      entry!,
      { productWord: "Product", productWordPlural: "Products" },
      { categories: [{ id: "c1", name: "Money Plants", slug: "succulents" }] },
    );
    const field = resolved.fields.find((item) => item.key === "categorySlug");

    expect(field?.options).toEqual([{ label: "Money Plants", value: "succulents" }]);
  });

  it("offers the SLUG as the value, because that is what the rail is keyed by", () => {
    /**
     * An id would store a rail key nothing can look up: `categoryRails` is
     * keyed by slug, and so is the collection page the row's CTA points at.
     */
    const entry = getRegistryEntry("category-rail")!;
    const resolved = resolveRegistryEntry(
      entry,
      { productWord: "Product", productWordPlural: "Products" },
      { categories: [{ id: "cat-abc", name: "Money Plants", slug: "succulents" }] },
    );

    expect(resolved.fields.find((f) => f.key === "categorySlug")?.options?.[0]?.value).toBe(
      "succulents",
    );
  });

  it("offers an empty list rather than a guess when there are no categories", () => {
    const entry = getRegistryEntry("category-rail")!;
    const resolved = resolveRegistryEntry(entry, {
      productWord: "Product",
      productWordPlural: "Products",
    });

    expect(resolved.fields.find((f) => f.key === "categorySlug")?.options).toEqual([]);
  });

  it("ships no default heading, because nothing has been chosen yet", () => {
    /**
     * A default title would be a claim about a category nobody has picked. The
     * three frozen rows each ship copy about cake, which is the thing this row
     * exists not to do.
     */
    const entry = getRegistryEntry("category-rail")!;

    expect(entry.defaultContent.title).toBe("");
    expect(entry.defaultContent.categorySlug).toBe("");
    expect(JSON.stringify(entry.defaultContent)).not.toMatch(/cake|bakery|eggless/i);
  });

  it("and its own name in Add Section is the shop's word, not a trade's", () => {
    /**
     * The LABEL, which is the line a shop reads when choosing what to add —
     * and the one thing about this row a `defaultContent` check does not cover.
     * A mutation that renamed it "Eggless Cakes by category" survived the rest
     * of this file, which is exactly how the three frozen rows above it came to
     * offer a plant shop three cake rows.
     *
     * `{Products}` is the token `resolveRegistryEntry` fills per shop.
     */
    const entry = getRegistryEntry("category-rail")!;
    expect(entry.label).toContain("{Products}");
    expect(entry.label).not.toMatch(/cake|bakery|eggless|photo|seasonal/i);

    const resolved = resolveRegistryEntry(entry, {
      productWord: "Plant",
      productWordPlural: "Plants",
    });
    expect(resolved.label).toBe("Plants by category");
  });
});

describe("the row reaches the page", () => {
  it("the server builds one rail per category and hands them over", () => {
    const service = code("features/products/data/products-service.ts");

    expect(service).toContain("categoryRails");
    expect(service).toContain("buildCategoryRail(category.slug");
  });

  it("and the renderer draws it from that, with no browser fallback", () => {
    /**
     * `railFor` falls back to `getHomepageProducts`, which takes one of the six
     * fixed sources — a category slug is not one of them, so there is nothing
     * to fall back TO. An empty row is correct; a guessed one would be the
     * demo-catalogue bug this prop exists to have fixed.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");

    expect(renderer).toContain("categoryRailFor");
    expect(renderer).toContain('case "category-rail":');
    expect(renderer).toMatch(/categoryRailFor[\s\S]{0,200}\?\?\s*\[\]/);
  });
});
