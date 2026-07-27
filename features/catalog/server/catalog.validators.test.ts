import { describe, expect, it } from "vitest";

import {
  categoriesSchema,
  weightsSchema,
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

  it("accepts a valid weights array", () => {
    const ok = weightsSchema.safeParse([
      { id: "wt-1", label: "1 kg", modifier: 200, serves: "8-10", sortOrder: 1 },
    ]);
    expect(ok.success).toBe(true);
  });

  it("rejects a weight with a non-numeric modifier", () => {
    expect(
      weightsSchema.safeParse([{ id: "wt-1", label: "1kg", modifier: "lots", serves: "x", sortOrder: 1 }])
        .success,
    ).toBe(false);
  });

  it("exposes exactly the four catalog sections", () => {
    expect(CATALOG_SECTIONS.sort()).toEqual(["categories", "flavours", "occasions", "weights"]);
    expect(Object.keys(catalogSectionSchemas).sort()).toEqual([
      "categories",
      "flavours",
      "occasions",
      "weights",
    ]);
  });
});
