import { describe, expect, it } from "vitest";

import { ProductModel } from "@/lib/server/db/models/product.model";
import { productFormSchema } from "@/features/products/server/product.validators";
import { normalizeCommerceFields } from "@/features/products/lib/products-repository";
import { mapAdminProductToStorefront } from "@/features/products/lib/product-mapper";
import type { Product, ProductDescriptionBlock } from "@/types/product";

/**
 * What a shop says about a product, in the shop's own shape.
 *
 * Everything a shop could say used to be a fixed food field: barcode, prep
 * time, shelf life, calories, allergens, care instructions. A phone shop
 * wanting Brand, Warranty or RAM had exactly one workaround — a variant group
 * with a single ₹0 option — and that is wrong three times over: the product
 * page renders every group as a row of clickable buttons, so a FACT reads as a
 * choice; `formatVariantSummary` folds it into `variantSummary`; and the order
 * line, the invoice and the baker's email then record it as something the
 * customer picked.
 *
 * The first answer to that was `attributes: { label, value }[]`, printed under
 * one fixed "Product Details" heading. Six reference storefronts were then read
 * one by one and none of them fits it: a cake wants four blocks, a plant wants
 * five with no heading over the first, a candle calls the same two Delivery
 * DETAILS and Care DIRECTIVES — and half the lines are whole sentences rather
 * than Label: Value at all. So a product carries BLOCKS: a heading the shop
 * types, and a body where one line is one bullet.
 *
 * THE POINT OF THIS FILE IS THE TWO SILENT FAILURES. Adding a field to the type
 * and the form makes the API answer 201 and change nothing, twice:
 *
 *   1. `productSchema` is built with only `{ minimize: false }`, so Mongoose
 *      `strict` is ON and an undeclared path is dropped on write with NO error.
 *      `productFormSchema` ends in `.passthrough()`, which looks like an escape
 *      hatch and is not — it proves validation accepts the field and says
 *      nothing about persistence.
 *   2. `mapAdminProductToStorefront` is an explicit whitelist with no spread. A
 *      field that does persist still never reaches a customer.
 *
 * Both fail quietly, in different layers, and a click-through in the admin
 * looks like it worked because the form re-renders its own state. So this walks
 * the whole chain — validator, Mongoose document, read-back normalisation,
 * storefront mapper — rather than checking any one of them.
 */

const BLOCKS: ProductDescriptionBlock[] = [
  {
    id: "blk-1",
    heading: "Product Details",
    body: "Brand: Samsung\nWarranty: 1 year",
  },
  {
    id: "blk-2",
    heading: "Delivery Information",
    body: "Shipped by our courier partners.\nYou will get a tracking number.",
  },
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
    descriptionBlocks: BLOCKS,
    ...overrides,
  };
}

describe("the write path accepts a shop's own description", () => {
  it("validates a well-formed block list", () => {
    const parsed = productFormSchema.parse(chargerForm()) as {
      descriptionBlocks?: ProductDescriptionBlock[];
    };

    expect(parsed.descriptionBlocks).toEqual(BLOCKS);
  });

  it("accepts a block with no heading, because two reference pages have one", () => {
    /**
     * The plant and the candle list their first block with no label over it.
     * A heading nobody typed must not be invented, and must not be a 400
     * either.
     */
    const parsed = productFormSchema.parse(
      chargerForm({
        descriptionBlocks: [{ id: "blk-1", heading: "", body: "Jar Candle\nWeight: 100ml" }],
      }),
    ) as { descriptionBlocks?: ProductDescriptionBlock[] };

    expect(parsed.descriptionBlocks?.[0]?.heading).toBe("");
    expect(parsed.descriptionBlocks?.[0]?.body).toContain("Jar Candle");
  });

  it("refuses garbage, which `.passthrough()` alone would wave through", () => {
    // The passthrough that makes a field "work" without a schema also accepts
    // `descriptionBlocks: "hello"` and an object with no body — both of which
    // reach Mongo as Mixed and then render as nothing, or as [object Object].
    expect(
      productFormSchema.safeParse(chargerForm({ descriptionBlocks: "hello" })).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse(chargerForm({ descriptionBlocks: [{ id: "a", heading: "X" }] }))
        .success,
      "a heading with nothing under it is the empty section this page keeps deleting",
    ).toBe(false);
    expect(
      productFormSchema.safeParse(
        chargerForm({ descriptionBlocks: [{ id: "a", heading: "X", body: "" }] }),
      ).success,
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
      descriptionBlocks: BLOCKS,
    });

    const stored = doc.toObject() as { descriptionBlocks?: ProductDescriptionBlock[] };

    expect(stored.descriptionBlocks, "Mongoose strict mode dropped the field").toBeDefined();
    expect(stored.descriptionBlocks).toHaveLength(2);
    expect(stored.descriptionBlocks?.[0]).toMatchObject({
      heading: "Product Details",
      body: "Brand: Samsung\nWarranty: 1 year",
    });
  });

  it("reads back as an empty list for a product that states nothing", () => {
    const read = normalizeCommerceFields({
      id: "p-plain",
      name: "Plain",
      slug: "plain",
      price: 10,
    } as never);

    expect(read.descriptionBlocks).toEqual([]);
  });

  it("keeps what a product does state", () => {
    const read = normalizeCommerceFields({
      id: "p-charger",
      name: "Charger",
      slug: "charger",
      price: 1499,
      descriptionBlocks: BLOCKS,
    } as never);

    expect(read.descriptionBlocks).toEqual(BLOCKS);
  });
});

describe("the description reaches a customer", () => {
  it("crosses the storefront mapper, which is a whitelist and not a spread", () => {
    // The second silent failure: named keys, no `...cake`. A field absent from
    // that list persists perfectly and is never seen by anyone.
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
      descriptionBlocks: BLOCKS,
      stockStatus: "in_stock",
      rating: 0,
      reviewCount: 0,
      seo: {},
    } as unknown as Product);

    expect(mapped.descriptionBlocks, "the mapper whitelist dropped the field").toEqual(BLOCKS);
  });
});

describe("a description block is a statement, not a choice", () => {
  it("is not a variant group, so nothing prices it or puts it on an order", () => {
    /**
     * Recorded as a decision rather than left as an omission. `CartLineItem`
     * carries what the customer CHOSE; a description is true of the product
     * whether or not anyone buys it, and `productSlug` on the line can look it
     * up. Putting it on the order would repeat the exact mistake the one-option
     * variant-group workaround makes.
     */
    const read = normalizeCommerceFields({
      id: "p-charger",
      name: "Charger",
      slug: "charger",
      price: 1499,
      descriptionBlocks: BLOCKS,
    } as never);

    // It does not become a group, so it is never priced and never summarised.
    expect(read.variantGroups).toEqual([]);
    expect(
      (read.descriptionBlocks ?? []).every((block) => !("priceAdjustment" in block)),
      "a description block must carry no price",
    ).toBe(true);
  });
});
