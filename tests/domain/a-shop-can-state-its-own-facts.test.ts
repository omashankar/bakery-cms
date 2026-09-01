import { describe, expect, it } from "vitest";

import { ProductModel } from "@/lib/server/db/models/product.model";
import { productFormSchema } from "@/features/products/server/product.validators";
import { normalizeCommerceFields } from "@/features/products/lib/products-repository";
import { mapAdminProductToStorefront } from "@/features/products/lib/product-mapper";
import type { Product, ProductAttribute } from "@/types/product";

/**
 * "Brand: Samsung" — a fact about the product, which this CMS could not hold.
 *
 * Everything a shop could say about a product was a fixed food field: barcode,
 * prep time, shelf life, calories, allergens, care instructions. A phone shop
 * wanting Brand, Warranty or RAM had exactly one workaround — a variant group
 * with a single ₹0 option — and that is wrong three times over: the product
 * page renders every group as a row of clickable buttons, so a FACT reads as a
 * choice; `formatVariantSummary` folds it into `variantSummary`; and the order
 * line, the invoice and the baker's email then record it as something the
 * customer picked.
 *
 * THE POINT OF THIS FILE IS THE TWO SILENT FAILURES. Adding the field to the
 * type and the form makes the API answer 201 and change nothing, twice:
 *
 *   1. `productSchema` is built with only `{ minimize: false }`, so Mongoose
 *      `strict` is ON and an undeclared path is dropped on write with NO error.
 *      `productFormSchema` ends in `.passthrough()`, which looks like an escape
 *      hatch and is not — it proves validation accepts the field and says
 *      nothing about persistence.
 *   2. `mapAdminProductToStorefront` is an explicit 25-key whitelist with no
 *      spread. A field that does persist still never reaches a customer.
 *
 * Both fail quietly, in different layers, and a click-through in the admin
 * looks like it worked because the form re-renders its own state. So this walks
 * the whole chain — validator, Mongoose document, read-back normalisation,
 * storefront mapper — rather than checking any one of them.
 */

const ATTRIBUTES: ProductAttribute[] = [
  { id: "attr-1", label: "Brand", value: "Samsung" },
  { id: "attr-2", label: "Warranty", value: "1 year" },
];

/** A complete, valid form payload for a product that is not a cake. */
function chargerForm(overrides: Record<string, unknown> = {}) {
  return {
    name: "65W Type-C Charger",
    slug: "type-c-charger",
    description: "Fast charging.",
    price: 1499,
    images: ["/charger.jpg"],
    categoryId: "cat-chargers",
    occasionIds: [],
    weights: [],
    status: "published",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    isEggless: false,
    isPhotoCake: false,
    isSeasonal: false,
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
    attributes: ATTRIBUTES,
    ...overrides,
  };
}

describe("the write path accepts a shop's own facts", () => {
  it("validates a well-formed attribute list", () => {
    const parsed = productFormSchema.parse(chargerForm()) as { attributes?: ProductAttribute[] };

    expect(parsed.attributes).toEqual(ATTRIBUTES);
  });

  it("refuses garbage, which `.passthrough()` alone would wave through", () => {
    // The passthrough that makes the field "work" without a schema also accepts
    // `attributes: "hello"` and an object with no value — both of which reach
    // Mongo as Mixed and then render as nothing, or as [object Object].
    expect(productFormSchema.safeParse(chargerForm({ attributes: "hello" })).success).toBe(false);
    expect(
      productFormSchema.safeParse(chargerForm({ attributes: [{ id: "a", label: "Brand" }] })).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse(chargerForm({ attributes: [{ id: "a", label: "", value: "x" }] }))
        .success,
    ).toBe(false);
  });
});

describe("the field actually persists", () => {
  it("survives the Mongoose schema instead of being dropped in silence", () => {
    /**
     * THE TRAP. Constructed rather than saved, because `strict` is applied when
     * the document is built — no database is needed to prove it, and no
     * database would have told us: an undeclared path is dropped with no error
     * and the API still answers 201.
     */
    const doc = new ProductModel({
      _id: "p-charger",
      name: "65W Type-C Charger",
      slug: "type-c-charger",
      attributes: ATTRIBUTES,
    });

    const stored = doc.toObject() as { attributes?: ProductAttribute[] };

    expect(stored.attributes, "Mongoose strict mode dropped the field").toBeDefined();
    expect(stored.attributes).toHaveLength(2);
    expect(stored.attributes?.[0]).toMatchObject({ label: "Brand", value: "Samsung" });
  });

  it("reads back as an empty list for a product that states nothing", () => {
    const read = normalizeCommerceFields({
      id: "p-plain",
      name: "Plain",
      slug: "plain",
      price: 10,
    } as never);

    expect(read.attributes).toEqual([]);
  });

  it("keeps what a product does state", () => {
    const read = normalizeCommerceFields({
      id: "p-charger",
      name: "Charger",
      slug: "charger",
      price: 1499,
      attributes: ATTRIBUTES,
    } as never);

    expect(read.attributes).toEqual(ATTRIBUTES);
  });
});

describe("the facts reach a customer", () => {
  it("crosses the storefront mapper, which is a whitelist and not a spread", () => {
    // The second silent failure: 25 named keys, no `...cake`. A field absent
    // from that list persists perfectly and is never seen by anyone.
    const mapped = mapAdminProductToStorefront({
      id: "p-charger",
      name: "65W Type-C Charger",
      slug: "type-c-charger",
      description: "",
      price: 1499,
      images: ["/charger.jpg"],
      categoryId: "cat-chargers",
      occasionIds: [],
      weights: [],
      status: "published",
      shapes: [],
      flavourOptions: [],
      variantGroups: [],
      attributes: ATTRIBUTES,
      stockStatus: "in_stock",
      rating: 0,
      reviewCount: 0,
      seo: {},
    } as unknown as Product);

    expect(mapped.attributes, "the mapper whitelist dropped the field").toEqual(ATTRIBUTES);
  });
});

describe("an attribute is a fact, not a choice", () => {
  it("is not a variant group, so nothing prices it or puts it on an order", () => {
    /**
     * Recorded as a decision rather than left as an omission. `CartLineItem`
     * carries what the customer CHOSE; an attribute is true of the product
     * whether or not anyone buys it, and `productSlug` on the line can look it
     * up. Putting it on the order would repeat the exact mistake the one-option
     * variant-group workaround makes.
     */
    const read = normalizeCommerceFields({
      id: "p-charger",
      name: "Charger",
      slug: "charger",
      price: 1499,
      attributes: ATTRIBUTES,
    } as never);

    // It does not become a group, so it is never priced and never summarised.
    expect(read.variantGroups).toEqual([]);
    expect(
      (read.attributes ?? []).every((attr) => !("priceAdjustment" in attr)),
      "an attribute must carry no price",
    ).toBe(true);
  });
});
