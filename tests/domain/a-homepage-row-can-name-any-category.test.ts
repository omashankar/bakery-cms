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

describe("every product row offers a way in to more of itself", () => {
  /**
   * The reference puts VIEW ALL on the heading line of every product row, at
   * the right-hand edge. This repo had it in two different states at once:
   * the category rows rendered a button CENTRED UNDER THE GRID, and
   * featured-cakes, trending and best-sellers had no view-all fields at all —
   * so a customer who read "Best Sellers" and wanted more of exactly that had
   * nowhere to go, while the row beside it offered a link.
   *
   * Blank still renders nothing. A shop that does not want the link does not
   * get one, which is why the fields ship empty rather than pointing somewhere
   * by default.
   */
  it("gives the three flag rows the same two fields the category rows have", () => {
    for (const type of ["featured-cakes", "trending", "best-sellers"] as const) {
      const entry = getRegistryEntry(type);
      const keys = (entry?.fields ?? []).map((field) => field.key);

      expect(keys, `${type} cannot be given a view-all`).toContain("ctaLabel");
      expect(keys, `${type} cannot be given a view-all`).toContain("ctaHref");
      // Empty, so nothing appears until a shop asks for it.
      expect(entry?.defaultContent.ctaLabel).toBe("");
      expect(entry?.defaultContent.ctaHref).toBe("");
    }
  });

  it("and the renderer actually draws it for them", () => {
    /**
     * The fields alone are a control that changes nothing — this repo's most
     * recorded defect. `showCta` is what puts the button on screen, and it was
     * passed for the category rows only.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");

    for (const source of ["featured", "trending", "best-sellers"]) {
      const at = renderer.indexOf(`railFor("${source}"`);
      expect(at, `${source} row is gone`).toBeGreaterThan(-1);
      expect(
        renderer.slice(at, at + 200),
        `the ${source} row still cannot show a view-all`,
      ).toContain("showCta");
    }
  });

  it("puts the link on the heading row, not under the grid", () => {
    /**
     * Under the grid, a customer who had already decided they wanted more of
     * this row had to scroll past four products to find the way in. On the
     * heading line it is where they are looking.
     *
     * The phone keeps it below — there is no room beside a centred heading at
     * that width, and a link nobody can reach is worse than one below the fold.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");
    /*
      FOUND BY WHAT THE ROW IS, not by what it is spaced at.

      This looked the grid up by its exact class string — `mt-8 grid gap-6
      sm:grid-cols-2` — so tightening the page's spacing broke a test about
      where a LINK sits. The grid is the thing that draws the cards; its
      margin is nobody's business here.
    */
    const grid = renderer.indexOf("<ProductCard key={cake.id}");
    // The inline button became a shared `ViewAllLink`, so the thing to find
    // on the heading line is the component, not the condition it replaced.
    const heading = renderer.lastIndexOf("<ViewAllLink", grid);

    expect(grid, "the product grid is gone").toBeGreaterThan(-1);
    expect(heading, "the view-all is no longer on the heading row").toBeGreaterThan(-1);
    expect(heading).toBeLessThan(grid);
    // And the one that remains below the grid is phone-only.
    expect(renderer).toMatch(/className="mt-\d+ text-center sm:hidden"/);
  });
});

describe("one heading, several tabs, one grid", () => {
  /**
   * Three product rows down a long page are three scrolls apart. Tabbed, they
   * are one band and a click — which is why the reference uses this shape more
   * than once on the same page, and why it was the one genuinely missing
   * section type once the open category row existed.
   *
   * The tabs name CATEGORIES the shop has, drawn from the same `categoryRails`
   * the open row uses. One answer to "what is in this category", not a second
   * that can drift from it.
   */
  it("is a section a shop can add", () => {
    const entry = getRegistryEntry("tabbed-rail");

    expect(entry, "the tabbed row is not in the registry").toBeDefined();
    expect(entry?.fields.map((f) => f.key)).toContain("tabs");
  });

  it("ships with no tabs, so it renders nothing until a shop writes one", () => {
    /**
     * A default tab would name a category nobody has chosen — and on a plant
     * shop it would name a cake one. The three frozen rows in this registry got
     * there exactly that way.
     */
    const entry = getRegistryEntry("tabbed-rail")!;

    expect(entry.defaultContent.tabs).toBe("[]");
    expect(entry.defaultContent.title).toBe("");
    expect(JSON.stringify(entry.defaultContent)).not.toMatch(/cake|bakery|flower/i);
  });

  it("its label is the shop's own word", () => {
    const entry = getRegistryEntry("tabbed-rail")!;
    const resolved = resolveRegistryEntry(entry, {
      productWord: "Plant",
      productWordPlural: "Plants",
    });

    expect(resolved.label).toBe("Tabbed plants");
  });

  it("fills each tab's category picker from the shop's own list", () => {
    /**
     * THE NESTED CASE, which is the whole reason this test exists.
     *
     * `resolveRegistryEntry` mapped the top-level fields only, so a select
     * inside a LIST — which is what a tab's category picker is — resolved to an
     * empty dropdown with nothing anywhere to say why. A shop would open the
     * editor, find no categories offered, and conclude the section was broken.
     */
    const entry = getRegistryEntry("tabbed-rail")!;
    const resolved = resolveRegistryEntry(
      entry,
      { productWord: "Product", productWordPlural: "Products" },
      { categories: [{ id: "c1", name: "Money Plants", slug: "succulents" }] },
    );

    const tabsField = resolved.fields.find((f) => f.key === "tabs");
    const picker = tabsField?.itemFields?.find((f) => f.key === "categorySlug");

    expect(picker?.options).toEqual([{ label: "Money Plants", value: "succulents" }]);
  });

  it("and the renderer draws it, keyed by tab position rather than by slug", () => {
    /**
     * By INDEX, because a shop can legitimately point two tabs at one category
     * — "Under ₹500" and "Gifts" can both be Gifts while the labels differ —
     * and keying by slug would make clicking one light up the other.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");

    expect(renderer).toContain('case "tabbed-rail":');
    expect(renderer).toContain("function TabbedRailSection");
    expect(renderer).toMatch(/const \[active, setActive\] = useState\(0\)/);
    expect(renderer).toContain("onClick={() => setActive(index)}");
  });

  it("and an empty tab says so rather than collapsing the band", () => {
    /**
     * The tabs beside it still work, and a customer who pressed this one needs
     * to know the press landed. A band that vanishes mid-click reads as broken.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");
    const section = renderer.slice(
      renderer.indexOf("function TabbedRailSection"),
      renderer.indexOf("function PromoCollageSection"),
    );

    expect(section).toContain("cakes.length === 0");
    expect(section).toContain("Nothing here yet.");
    // But no tabs at all IS nothing to draw.
    expect(section).toContain("tabs.length === 0) return null");
  });
});
