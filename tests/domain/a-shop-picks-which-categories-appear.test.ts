import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * WHICH CATEGORIES A BAND SHOWS — the shop's choice, not the first few.
 *
 * Both category bands took `props.categories.slice(0, maxCount)`: whichever
 * the catalogue happened to list first, in whatever order it happened to hold
 * them. The shop asked to choose.
 *
 * FOUR TRAPS, all of them measured on this shop's own data rather than
 * imagined:
 *
 *   The automatic row DROPS a category with no picture and caps the rest at
 *   twelve. Three of this shop's eleven carry no picture, so a picker
 *   resolving against that list would have offered Chocolate, Premium and
 *   Classic and then drawn nothing for them.
 *
 *   Two of its categories share the slug `seasonal`. Resolving a pick with a
 *   filter draws it twice, under one React key.
 *
 *   `maxCount` and a pick list are two controls over one decision. Picking
 *   eight with the box at six loses two of the shop's own choices.
 *
 *   `our-menu` draws the identical list through the identical line. Giving
 *   the picker to one band leaves the page still showing the same categories
 *   twice — which is the complaint that started this.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const PICKERS = ["categories", "our-menu"];

function bodyOf(name: string): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf(`function ${name}(`);
  expect(at, `${name} is gone`).toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

describe("a shop picks which categories appear", () => {
  it("is offered on BOTH bands that draw categories, not just the one reported", () => {
    for (const type of PICKERS) {
      const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === type);
      expect(entry, `${type} is gone from the registry`).toBeTruthy();

      const picks = entry!.fields.find((f) => f.key === "picks");
      expect(picks, `${type} cannot be picked`).toBeTruthy();
      expect(picks!.type).toBe("list");
      expect(entry!.defaultContent.picks, `${type} ships with picks already made`).toBe("[]");
    }
  });

  it("and each row picks from the shop's own catalogue", () => {
    /*
      `optionsFrom` rather than a written-out list: the registry is plain data
      with no way to reach the catalogue, and a hardcoded list of categories is
      the bakery wording this page has been cleaned of twice.

      A field that declares BOTH `options` and `optionsFrom` silently keeps the
      hardcoded ones — see withResolvedOptions — so the absence matters.
    */
    for (const type of PICKERS) {
      const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === type);
      const columns = entry!.fields.find((f) => f.key === "picks")?.itemFields ?? [];
      const slug = columns.find((col) => col.key === "categorySlug");

      expect(slug, `${type}'s rows pick nothing`).toBeTruthy();
      expect(slug!.optionsFrom, `${type}'s picker is not fed the catalogue`).toBe("categories");
      expect(slug!.options, `${type}'s picker has a hardcoded list that wins`).toBeUndefined();

      // The two overrides, both blank by default — a category with no picture
      // is the case they exist for.
      expect(columns.map((col) => col.key).sort()).toEqual(["categorySlug", "image", "label"]);
    }
  });

  it("and both bands resolve their picks the same way", () => {
    /*
      THE COMPLAINT THAT STARTED THIS was the same categories drawn twice.
      Fixing one band and leaving the other is the half-done shape of that
      complaint, and it reads as finished.
    */
    for (const name of ["CategoriesSection", "OurMenuSection"]) {
      const body = bodyOf(name);
      expect(body, `${name} does not read its own list`).toContain(
        'parseListField(c, "picks")',
      );
      expect(body, `${name} resolves picks on its own`).toContain("categoriesForBand(");
    }
  });

  it("and a pick beats the count box rather than being cut by it", () => {
    const resolver = bodyOf("categoriesForBand");

    // Nothing picked: the band as it always was.
    expect(resolver, "the automatic row is gone").toContain(
      "(props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount)",
    );
    // Something picked: no slice anywhere after that.
    const after = resolver.slice(resolver.indexOf("if (picks.length === 0)"));
    const picked = after.slice(after.indexOf("}"));
    expect(picked.includes("maxCount"), "the count box still cuts the shop's picks").toBe(false);
  });

  it("and resolves against EVERY category, not the automatic row", () => {
    /*
      `props.categories` has every pictureless category filtered out and the
      rest capped at twelve. Three of this shop's eleven have no picture, so
      resolving picks against it means the shop picks Chocolate and the band
      draws nothing — with no error and nothing in the builder to explain it.
    */
    expect(bodyOf("categoriesForBand"), "picks resolve against the filtered row").toContain(
      "props.categoryChoices ?? props.categories",
    );

    const server = read("apps/website/lib/homepage-render-data.server.ts");
    expect(server, "the page does not carry the whole list").toContain("categoryChoices:");
    expect(server, "the whole list is filtered like the automatic one").toContain(
      "{ requirePicture: false }",
    );
  });

  it("and draws a pick once, even when two categories share a slug", () => {
    // This shop has two rows called Seasonal. A filter draws the pick twice,
    // under one React key.
    const resolver = bodyOf("categoriesForBand");

    expect(resolver, "picks are resolved by scanning rather than by lookup").toContain(
      "new Map<string, LandingCategory>()",
    );
    expect(resolver, "a duplicate slug overwrites the first").toContain("if (!bySlug.has(");
  });

  it("and drops a pick whose category has gone", () => {
    /*
      The alternative is a tile captioned with a raw slug under a count of
      zero — a claim about a shop that no longer sells the thing. The picker
      only ever offers live categories, so this is the after-a-deletion case.
    */
    expect(bodyOf("categoriesForBand"), "a dead slug still draws a tile").toContain(
      "if (!found) return [];",
    );
  });

  it("and the tile counts in the shop's own word", () => {
    // It said "cakes" for every shop running this CMS. This one has set
    // "products" in its settings and the tile was ignoring it.
    const body = bodyOf("CategoriesSection");

    expect(body.includes("} cakes"), "the tile names the trade again").toBe(false);
    expect(body, "the tile does not use the shop's word").toContain(
      "labels.productWordPlural.toLowerCase()",
    );
  });
});
