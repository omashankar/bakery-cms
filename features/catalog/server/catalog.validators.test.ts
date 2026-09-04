import { describe, expect, it } from "vitest";

import {
  categoriesSchema,
  catalogSectionSchemas,
  CATALOG_SECTIONS,
} from "./catalog.validators";

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


  it("exposes exactly the three catalog sections", () => {
    /**
     * There was a fourth, `weights` — a shop-wide list of sizes every product
     * derived its tiers from. Sizes are typed on the product now, so the
     * section is gone and a PUT or a reset naming it is refused by the
     * allowlist, which is the same answer any other unknown section gets.
     *
     * Exact equality on purpose: a section added or dropped without a
     * deliberate decision fails here.
     */
    expect(CATALOG_SECTIONS.sort()).toEqual(["categories", "flavours", "occasions"]);
    expect(Object.keys(catalogSectionSchemas).sort()).toEqual([
      "categories",
      "flavours",
      "occasions",
    ]);
  });
});
