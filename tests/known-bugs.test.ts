/**
 * Regression tests for defects caused by bakery vocabulary being load-bearing
 * in business logic.
 *
 * These were all `.fails()` while the bugs were live. They now assert the
 * correct behaviour: variant options carry an explicit `semantic`, and logic
 * branches on that instead of pattern-matching English words in a label.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyProductForm } from "@/features/products/lib/products-repository";
import { getProductShapeOptions } from "@/apps/website/lib/product-details";

beforeEach(() => {
  localStorage.clear();
});

/*
  Four blocks stood here, and every one was about a product FLAG derived from
  what its options meant: the save-payload mirror, the Eggless tick, the Photo
  cake tick, the proof that both were read off `semantic` rather than off a
  merchant's label, and the migration that gave old records a semantic to read.

  There are no such flags left. `isEggless` said a recipe contained no eggs —
  the shop's claim to make, in its own words. `isPhotoCake` said a product
  offered a paid photo print, and a print is priced into the product now
  rather than chosen between. What remains is `allowsPhotoUpload`: a plain
  tick, with nothing deriving it and so nothing able to overwrite it.
*/
describe("the shape list was duplicated and divergent, and is not any more", () => {
  /**
   * CLOSED. It was FOUR copies, and the two that mattered were not lists of
   * what a product offers but defaults imposed on every product that named
   * none — so a phone charger was sold in Round, Square and Heart.
   *
   * The last of it was the admin form hardcoding four shapes as checkboxes
   * while `DEFAULT_PRODUCT_SHAPES` knew three: tick “Rectangle” and no shared
   * list agreed it existed. That list is gone. A shape is a typed VARIANT
   * GROUP now, so a shop names its own and prices each one, and there is no
   * second list left to diverge from.
   */
  it("names no shapes of its own anywhere", () => {
    expect(createEmptyProductForm().shapes).toEqual([]);
    expect(getProductShapeOptions({ shapes: [] } as never)).toEqual([]);

    const form = readFileSync(
      join(process.cwd(), "apps/admin/products/components/product-form-page.tsx"),
      "utf8",
    );

    // Read from the FORM, not retyped here — the first version of this declared
    // the four names three lines above asserting on them, which is a literal
    // checked against itself.
    expect(form).not.toContain("Available shapes");
    expect(form).not.toContain("toggleShape");
  });
});
