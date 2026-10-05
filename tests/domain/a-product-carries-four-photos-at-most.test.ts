import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_PRODUCT_PHOTOS } from "@/features/products/lib/product-limits";
import { productFormSchema } from "@/features/products/server/product.validators";

/**
 * Four photos, and the shop said four.
 *
 * The Media tab offered "Add another photo" without end, and nothing anywhere
 * counted them: the type, the Mongoose path, the validator and the form's own
 * submit had all handled an unbounded array since the day one-photo-per-product
 * was fixed.
 *
 * A cap in the FORM alone would not be a cap. That is the shape of three
 * defects this project has already fixed — the delivery slots, the minimum
 * order value and the shop-wide lead time were each configured in the admin,
 * checked in the browser, and honoured by nothing when a request arrived
 * without one. So the number lives in one module and both sides read it.
 *
 * WHAT HAPPENS TO A PRODUCT THAT ALREADY HAS MORE. One does: this shop's "Ring
 * Ceremony Special Cake" carries five. It keeps them. The form shows every box
 * with its Remove button, hides the Add button, says how many to remove, and
 * the save is refused until the count is down — because trimming them here
 * would delete a photograph the shop uploaded, silently, on a save it made for
 * some other reason.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const photos = (count: number) => Array.from({ length: count }, (_, i) => `/photo-${i}.jpg`);

/** A complete, valid form payload — photos are the only thing under test. */
const form = (images: string[]) => ({
  name: "Ring Ceremony Special Cake",
  slug: "ring-ceremony-special-cake",
  description: "",
  price: 999,
  images,
  categoryId: "cat-1",
  occasionIds: [],
  weights: [],
  status: "published",
  isFeatured: false,
  isBestSeller: false,
  isTrending: false,
  shapes: [],
  flavourOptions: [],
  stockStatus: "in_stock",
  stockQuantity: 10,
  unlimitedStock: false,
  allowsMessage: false,
  allowsPhotoUpload: false,
  variantGroups: [],
  rating: 0,
  reviewCount: 0,
  seo: {},
});

describe("the cap", () => {
  it("is four", () => {
    expect(MAX_PRODUCT_PHOTOS).toBe(4);
  });

  it("is one number, read by the form and by the server", () => {
    /**
     * Two copies drift. The form would stop offering a box while a direct POST
     * still stored ten, or the server would refuse a save the admin had no way
     * to see coming.
     */
    const validators = read("features/products/server/product.validators.ts");
    const formPage = read("apps/admin/products/components/product-form-page.tsx");
    const importLine = 'from "@/features/products/lib/product-limits"';

    expect(validators).toContain(importLine);
    expect(formPage).toContain(importLine);
    // …and neither writes the number out for itself.
    expect(formPage).not.toContain("photoSlots.length < 4");
  });
});

describe("the server, which is where a cap has to hold", () => {
  it("accepts a product at the cap", () => {
    const parsed = productFormSchema.safeParse(form(photos(MAX_PRODUCT_PHOTOS)));

    expect(parsed.success).toBe(true);
  });

  it("refuses one over it, and says what to do", () => {
    const parsed = productFormSchema.safeParse(form(photos(MAX_PRODUCT_PHOTOS + 1)));

    expect(parsed.success).toBe(false);
    const message = parsed.success ? "" : parsed.error.issues.map((i) => i.message).join(" ");
    expect(message).toContain(String(MAX_PRODUCT_PHOTOS));
    expect(message.toLowerCase()).toContain("remove");
  });

  it("still accepts a product with none, which is most of them", () => {
    expect(productFormSchema.safeParse(form([])).success).toBe(true);
  });
});

describe("the form, which is where an admin meets it", () => {
  it("stops offering another box at the cap", () => {
    const page = read("apps/admin/products/components/product-form-page.tsx");

    expect(page).toContain("{photoSlots.length < MAX_PRODUCT_PHOTOS ? (");
  });

  it("refuses the save itself, so the admin reads a sentence and not a 400", () => {
    const page = read("apps/admin/products/components/product-form-page.tsx");

    expect(page).toContain("if (photos.length > MAX_PRODUCT_PHOTOS) {");
    expect(page).toContain("const photos = form.images.filter(Boolean);");
  });

  it("keeps the photos a product already has, and says how many to remove", () => {
    /**
     * The one product in this shop with five. Silently dropping the fifth on
     * the next save — a save made to change the price, say — would delete a
     * photograph nobody asked to delete.
     */
    const page = read("apps/admin/products/components/product-form-page.tsx");

    expect(page).toContain("{photoSlots.filter(Boolean).length > MAX_PRODUCT_PHOTOS ? (");
    // Every box still renders, so every one can be looked at and removed.
    expect(page).toContain("{photoSlots.map((url, index) => (");
    expect(page).not.toContain("images.slice(0, MAX_PRODUCT_PHOTOS)");
  });
});
