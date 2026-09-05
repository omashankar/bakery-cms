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


  it("exposes exactly the two catalog sections", () => {
    /**
     * There were four. `weights` went when sizes became something typed on the
     * product, and `flavours` went the same way for the same reason — a
     * flavour was a word on a product, not a list anybody maintained, and the
     * shop-wide copy could offer one nothing was sold in while missing one
     * twenty products carried.
     *
     * A PUT or a reset naming either is refused by the allowlist, which is the
     * same answer any other unknown section gets.
     *
     * Exact equality on purpose: a section added or dropped without a
     * deliberate decision fails here.
     */
    expect(CATALOG_SECTIONS.sort()).toEqual(["categories", "occasions"]);
    expect(Object.keys(catalogSectionSchemas).sort()).toEqual(["categories", "occasions"]);
  });
});
