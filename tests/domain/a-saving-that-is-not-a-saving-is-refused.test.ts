import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { productFormSchema } from "@/features/products/server/product.validators";
import { displayCompareAtPrice } from "@/features/products/lib/product-pricing";

/**
 * A COMPARE-AT AT OR BELOW THE PRICE SAVED QUIETLY AND THEN DREW NOTHING.
 *
 * The storefront has always been honest about it: `displayCompareAtPrice`
 * returns undefined for such a pair, deliberately, because shifting it would
 * turn "we charge more than we say" into a badge. What was missing was
 * anybody telling the SHOP. Two published products on this catalogue hold a
 * compare-at below their price — typed the wrong way round — and the only
 * symptom is a saving that never appears, which looks exactly like not having
 * set one.
 *
 * WHY NOT A PERCENTAGE CAP: an eighty-per-cent clearance is real, so a cap
 * refuses an honest sale while a shop inflating by forty per cent sails
 * through, and it would be this software inventing pricing policy for a shop.
 * At or below the price is the only case that is provably not a discount,
 * which is the only case a validator has standing to reject.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * The smallest thing `productFormSchema` will accept, so each case below
 * differs from its neighbour by the one field it is about.
 */
function product(overrides: Record<string, unknown> = {}) {
  return {
    name: "A product",
    slug: "a-product",
    price: 999,
    status: "published",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    stockStatus: "in_stock",
    stockQuantity: 5,
    unlimitedStock: false,
    allowsMessage: false,
    allowsPhotoUpload: false,
    rating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("the compare-at price the wire will accept", () => {
  it("takes one above the price, which is a saving", () => {
    const parsed = productFormSchema.safeParse(product({ compareAtPrice: 2000 }));
    expect(parsed.success).toBe(true);
  });

  it("refuses one at or below it, on the field itself", () => {
    for (const compareAtPrice of [999, 849, 1]) {
      const parsed = productFormSchema.safeParse(product({ compareAtPrice }));
      expect(parsed.success, `${compareAtPrice} against 999 was accepted`).toBe(false);
      if (!parsed.success) {
        /*
          ON `compareAtPrice`, not on the form — the admin has no path-to-field
          mapping, so the path is what a later mapping will need and what says
          which of two numbers is wrong.
        */
        expect(parsed.error.issues.some((i) => i.path[0] === "compareAtPrice")).toBe(true);
      }
    }
  });

  it("and lets a shop clear it, because zero and absent are the same thing", () => {
    // Without the `> 0` guard a product whose box is being emptied is a
    // permanent 400 — and `"0"` is truthy, so zeros were reaching the wire.
    expect(productFormSchema.safeParse(product({ compareAtPrice: 0 })).success).toBe(true);
    expect(productFormSchema.safeParse(product({ compareAtPrice: undefined })).success).toBe(true);
  });

  it("says nothing about a draft, which is still being written", () => {
    expect(
      productFormSchema.safeParse(product({ status: "draft", compareAtPrice: 849 })).success,
      "a draft cannot be saved while its numbers are half typed",
    ).toBe(true);
  });

  it("and the rule matches the one the card already keeps", () => {
    /*
      The validator and `displayCompareAtPrice` must agree, or the wire
      refuses a pair the storefront would have drawn, or accepts one it will
      silently drop. Asserted against the function rather than against a
      second copy of the comparison.
    */
    expect(displayCompareAtPrice(999, 2000, 999)).toBe(2000);
    expect(displayCompareAtPrice(999, 999, 999)).toBeUndefined();
    expect(displayCompareAtPrice(999, 849, 999)).toBeUndefined();
  });
});

describe("what the admin says before the wire has to", () => {
  it("checks it in the browser and names the tab", () => {
    /**
     * THE WIRE HALF IS NOT ENOUGH ON ITS OWN. The save handler catches a
     * server error into a bare `toast.error(error.message)` — there is no
     * path-to-field mapping in this file — so the refusal alone would read as
     * "could not save" with nothing marked, on a field the owner may not have
     * touched. This is the repo's own pattern for a cross-field rule.
     */
    const admin = code("apps/admin/products/components/product-form-page.tsx");
    expect(admin).toContain("compareAtTyped && compareAtTyped <= form.price");
    expect(admin, "the message does not say where to go").toMatch(/Price & stock, at the top/);
  });

  it("shows the real numbers while they are being typed", () => {
    const admin = code("apps/admin/products/components/product-form-page.tsx");
    /*
      Through the same function the card calls, never a second copy of the
      comparison — that is how an admin and a storefront come to disagree
      about what a shop is advertising.
    */
    expect(admin).toContain("displayCompareAtPrice(");
    expect(admin).toContain("compareAtShown");
  });

  it("and an emptied box stops storing a zero", () => {
    const admin = code("apps/admin/products/components/product-form-page.tsx");
    expect(admin, '"0" is truthy, so a typed zero still persists').not.toMatch(
      /compareAtPrice: e\.target\.value\s*\n?\s*\? Number\(e\.target\.value\)/,
    );
    expect(admin).toContain("Number(e.target.value) > 0");
  });
});
