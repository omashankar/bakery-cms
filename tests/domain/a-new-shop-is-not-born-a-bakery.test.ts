import { describe, expect, it } from "vitest";

import {
  defaultCategories,
  findSlugClash,
} from "@/features/catalog/lib/catalog-utils";
import { seedProducts } from "@/features/products/lib/products-repository";
import { categoriesSchema } from "@/features/catalog/server/catalog.validators";

/**
 * What a brand-new shop is handed before it has typed anything.
 *
 * 46b04b2 stopped the FORM inventing cake data for a product that declared
 * none, and left the SEED doing all of it: `mapLandingProductToAdmin` stamped
 * Round/Square/Heart, 320 kcal, a 3-day shelf life and "Refrigerate within 2
 * hours of delivery" onto every demo product, and `seedIfEmpty` writes that
 * into a fresh shop's database. A charger shop's first load filled its
 * catalogue with cake data nobody had entered.
 *
 * And the shipped taxonomy carried a collision: `defaultCategories` spreads
 * landing-data's "Seasonal" (slug `seasonal`) and then appends `cat-seasonal`
 * with the SAME slug. `getStorefrontCategories` de-dupes by slug and keeps the
 * FIRST row, so the second was unreachable — no 404, no error, just a category
 * whose products could not be browsed to. Every fresh install shipped it, and
 * so did every "Reset defaults" on the Catalog screen.
 *
 * (The live database was checked before this was written: 11 categories, no
 * duplicate slugs, every one with products. The collision is in the shipped
 * data, not in this shop — so there is no live-data repair to make.)
 */

describe("the shipped taxonomy", () => {
  it("has no two categories claiming the same slug", () => {
    const slugs = defaultCategories.map((category) => category.slug);

    expect(new Set(slugs).size, `duplicate slug in the seed: ${slugs.join(", ")}`).toBe(
      slugs.length,
    );
  });

  it("gives every category a slug at all", () => {
    // `dedupeBySlug` drops a row with no slug entirely — "a row with no slug is
    // not a category anyone can reach".
    expect(defaultCategories.every((category) => category.slug?.trim())).toBe(true);
  });

  it("still validates against the section schema it will be written with", () => {
    expect(categoriesSchema.safeParse(defaultCategories).success).toBe(true);
  });
});

describe("nothing lets a second row claim a slug", () => {
  const rows = [
    { id: "1", name: "Seasonal", slug: "seasonal" },
    { id: "2", name: "Birthday", slug: "birthday" },
  ];

  it("finds the row already using it", () => {
    expect(findSlugClash(rows, "seasonal")?.name).toBe("Seasonal");
  });

  it("does not refuse a row for clashing with itself", () => {
    // Saving "Seasonal" without touching its slug must not be blocked by
    // "Seasonal".
    expect(findSlugClash(rows, "seasonal", "1")).toBeUndefined();
  });

  it("catches a clash that differs only by case or padding", () => {
    // Both reach the same URL, so both are the same slug.
    expect(findSlugClash(rows, "  Seasonal ")?.id).toBe("1");
  });

  it("allows a genuinely new slug", () => {
    expect(findSlugClash(rows, "cold-drinks")).toBeUndefined();
  });
});

describe("the demo products a fresh shop is seeded with", () => {
  const seeded = seedProducts();

  it("exists, so the guard below is not vacuous", () => {
    expect(seeded.length).toBeGreaterThan(0);
  });

  it("invents no shapes for a product that never declared any", () => {
    /**
     * The same line, in the same words, that `normalizeCommerceFields` had
     * removed: `shapes: [...DEFAULT_PRODUCT_SHAPES]`. Nothing in the landing
     * data says a product comes in Round, Square and Heart — the seed said it
     * on their behalf, and the storefront then offered the picker.
     */
    expect(seeded.every((product) => product.shapes.length === 0)).toBe(true);
  });

  it("invents no nutrition, shelf life or care instructions", () => {
    // 320 kcal on every product in the shop is not data, it is a placeholder
    // rendered as a fact on the customer's page.
    expect(seeded.every((product) => product.calories === undefined)).toBe(true);
    expect(seeded.every((product) => product.shelfLifeDays === undefined)).toBe(true);
    expect(seeded.every((product) => !product.careInstructions)).toBe(true);
  });

  it("keeps what the demo data actually declares", () => {
    // The guard must not turn into "seed nothing" — a demo with no prices and
    // no names demonstrates nothing.
    expect(seeded.every((product) => product.name.trim().length > 0)).toBe(true);
    expect(seeded.every((product) => product.price > 0)).toBe(true);
    expect(seeded.some((product) => product.images.length > 0)).toBe(true);
  });
});
