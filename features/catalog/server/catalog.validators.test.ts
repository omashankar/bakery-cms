import { describe, expect, it } from "vitest";

import {
  categoriesSchema,
  catalogSectionSchemas,
  CATALOG_SECTIONS,
} from "./catalog.validators";
import {
  CATALOG_SECTIONS as clientSections,
} from "@/features/catalog/lib/catalog-api";
import {
  catalogSectionDefaults as sectionDefaults,
} from "@/features/catalog/lib/catalog-utils";

describe("catalog validators", () => {
  it("accepts a valid categories array", () => {
    const ok = categoriesSchema.safeParse([
      { id: "cat-1", name: "Chocolate", slug: "chocolate", createdAt: "x", updatedAt: "y" },
    ]);
    expect(ok.success).toBe(true);
  });

  it("rejects a category missing a name", () => {
    expect(categoriesSchema.safeParse([{ id: "cat-1", name: "", slug: "s" }]).success).toBe(false);
  });

  it("rejects a category without an id", () => {
    expect(categoriesSchema.safeParse([{ name: "X", slug: "x" }]).success).toBe(false);
  });


  it("exposes exactly the catalog sections the shop keeps", () => {
    /**
     * There were four, then two, now three. `weights` went when sizes became
     * something typed on the product, and `flavours` went the same way for the
     * same reason — a flavour was a word on a product, not a list anybody
     * maintained, and the shop-wide copy could offer one nothing was sold in
     * while missing one twenty products carried. `collections` was ADDED, as a
     * curated group a shop fills from its own side.
     *
     * A PUT or a reset naming a section not on this list is refused by the
     * allowlist, which is the same answer any other unknown section gets.
     *
     * Exact equality on purpose: a section added or dropped without a
     * deliberate decision fails here — this case had to be edited to admit
     * collections, and that edit is the decision.
     */
    expect(CATALOG_SECTIONS.sort()).toEqual([
      "categories",
      "collections",
      "departments",
      "occasions",
    ]);
    expect(Object.keys(catalogSectionSchemas).sort()).toEqual([
      "categories",
      "collections",
      "departments",
      "occasions",
    ]);
  });

  it("and the browser cannot name a section the server will not take", () => {
    /**
     * The two lists that must agree, asserted as one identity.
     *
     * `CATALOG_SECTIONS` in catalog-api.ts is what the BROWSER pushes and what
     * backup/restore iterates; `catalogSectionSchemas` here is what the server
     * accepts. Add to one and not the other and the failure is quiet in both
     * directions: a write that 404s, or a section the shop can never back up.
     */
    const browserSide = [...clientSections].sort();
    expect(browserSide).toEqual(Object.keys(catalogSectionSchemas).sort());
  });

  it("and every section the server accepts can also be reset", () => {
    /**
     * The third list. A section with a schema but no entry in `SECTION_DEFAULTS`
     * accepts writes and then 404s on Reset — one enumerated list silently
     * excluding a member, which is this repo's recorded failure shape.
     */
    for (const section of Object.keys(catalogSectionSchemas)) {
      expect(
        Object.hasOwn(sectionDefaults, section),
        `${section} has no default, so Reset would 404`,
      ).toBe(true);
    }
  });
});
