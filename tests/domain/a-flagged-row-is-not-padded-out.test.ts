import { describe, expect, it } from "vitest";

import {
  buildHomepageProducts,
  matchHomepageSource,
} from "@/features/products/lib/homepage-rails";
import type { LandingProduct } from "@/constants/landing-data";
import type { Product } from "@/types/product";

/**
 * THE SELECTION, NOT A FULL GRID.
 *
 * `buildHomepageProducts` pads a row up to `maxCount` from the wider
 * catalogue, so a Best Sellers grid is never three cards and a gap. That is a
 * display decision, and it is fine for the band it was written for.
 *
 * It is NOT fine for a caller asking which products carry a flag — and the
 * obvious way to ask, calling the padded function with a huge maxCount, does
 * the exact opposite of what it looks like: it pads with the entire shop.
 *
 * That shipped. The Bestsellers row's Birthday tab listed eight products, of
 * which three were not bestsellers, on a band whose heading is the claim.
 * Found by clicking through the tabs on the live page and reading the names,
 * not by reading the code.
 */
function product(id: string, flags: Partial<Product> = {}): Product {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    description: "",
    price: 100,
    images: [],
    categoryId: "c1",
    categoryIds: ["c1"],
    occasionIds: [],
    weights: [],
    status: "published",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    isEggless: false,
    isPhotoCake: false,
    isSeasonal: false,
    allowsMessage: false,
    allowsPhotoUpload: false,
    flavourOptions: [],
    shapes: [],
    variantGroups: [],
    deliveryTierIds: [],
    stockStatus: "in_stock",
    ...flags,
  } as unknown as Product;
}

describe("a row that names a flag", () => {
  const flagged = product("1", { isBestSeller: true });
  const ordinary = ["2", "3", "4", "5", "6"].map((id) => product(id));
  const admin = [flagged, ...ordinary];
  const all = admin.map(
    (p) => ({ id: p.id, slug: p.slug, name: p.name, price: 100, category: "Cakes" }) as LandingProduct,
  );

  it("returns only what carries the flag", () => {
    const matched = matchHomepageSource("best-sellers", admin, all);

    expect(matched.map((p) => p.slug)).toEqual([flagged.slug]);
  });

  it("is not the same as asking the padded one for everything", () => {
    /*
      The whole defect in one assertion. A huge maxCount reads as "no limit"
      and means "pad until you run out of shop".
    */
    const padded = buildHomepageProducts(
      "best-sellers",
      Number.MAX_SAFE_INTEGER,
      admin,
      all,
    );

    expect(padded.length, "the padded call stopped padding").toBeGreaterThan(1);
    expect(
      matchHomepageSource("best-sellers", admin, all).length,
      "the unpadded call pads too",
    ).toBeLessThan(padded.length);
  });

  it("still pads the plain band, which is what that is for", () => {
    // Not a regression in disguise: the band this padding was written for
    // keeps it. One flagged product and a grid of four is still four.
    const row = buildHomepageProducts("best-sellers", 4, admin, all);

    expect(row).toHaveLength(4);
    expect(row[0].slug, "the flagged one lost its place at the front").toBe(flagged.slug);
  });
});
