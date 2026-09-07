import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { shopMegaMenu } from "@/constants/storefront-nav";
import { buildHomepageProducts } from "@/features/products/lib/homepage-rails";
import { filterProductsByCategory } from "@/features/products/lib/product-catalog";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
import type { Product } from "@/types/product";

/**
 * "Seasonal" was a tick on the product, and the shop had two answers to one
 * question.
 *
 * The site already says what is seasonal in one place: the CATEGORY. The nav's
 * "Seasonal" link, the mega-menu's featured card and the collection page all
 * read `/collections/seasonal`, which is served by the category — while the
 * homepage row read `isSeasonal`. So a cake ticked Seasonal but filed under
 * Birthday appeared in the row and was missing from the page the row links to,
 * and a cake filed under Seasonal without the tick was the other way round.
 * Nobody had done anything wrong; there were simply two lists.
 *
 * There is one list now. The tick is gone from the type, the Mongoose path, the
 * validator, the empty form, the admin's Commerce tab and the admin's type
 * filter, and the row selects on the category like everything else does.
 *
 * What is lost: a shop can no longer mark a cake seasonal while filing it
 * elsewhere. That is the point — it was never a second fact, only a second
 * place to state the first one.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * The same file with its comments taken out.
 *
 * Every removal in this repo leaves a tombstone naming what went — including
 * the one directly above — so an unstripped search for the removed string
 * matches the EXPLANATION and the guard passes for the thing it forbids.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/** The shop's own names by id, so mapping never reads the demo taxonomy. */
const names = {
  categories: new Map([
    ["cat-seasonal", "Seasonal"],
    ["cat-birthday", "Birthday"],
  ]),
};

const product = (slug: string, categoryId: string, status = "published"): Product =>
  ({
    id: slug,
    name: slug,
    slug,
    description: "",
    price: 999,
    images: ["/cake.jpg"],
    categoryId,
    occasionIds: [],
    weights: [],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    attributes: [],
    allowsMessage: true,
    allowsPhotoUpload: false,
    status,
  }) as unknown as Product;

/** Filed under Seasonal — and carrying no flag of any kind, deliberately. */
const mango = product("mango-gateau", "cat-seasonal");
/** The cake a shop would once have ticked Seasonal while filing it here. */
const truffle = product("chocolate-truffle", "cat-birthday");
const unpublished = product("winter-log", "cat-seasonal", "draft");

describe("the homepage seasonal row", () => {
  it("is the products the shop filed under Seasonal", () => {
    const row = buildHomepageProducts("seasonal", 4, [mango, truffle], [], names);

    expect(row.map((cake) => cake.slug)).toEqual(["mango-gateau"]);
  });

  it("holds exactly what the page it links to holds", () => {
    /**
     * The row is a shortcut to a collection page. Read the slug off the nav
     * rather than writing it again here, so the two cannot drift apart in the
     * one direction this test exists to prevent.
     */
    const link = shopMegaMenu.categories.find((entry) => entry.label === "Seasonal");
    const slug = link?.href.split("/").pop() ?? "";
    expect(slug).toBe("seasonal");

    const catalogue = [mango, truffle];
    const row = buildHomepageProducts("seasonal", 4, catalogue, [], names);
    const page = filterProductsByCategory(getPublishedStorefrontProducts(catalogue, names), slug);

    expect(row.map((cake) => cake.slug)).toEqual(page.map((cake) => cake.slug));
    expect(page.map((cake) => cake.slug)).toEqual(["mango-gateau"]);
  });

  it("still shows only published products", () => {
    const row = buildHomepageProducts("seasonal", 4, [unpublished, mango], [], names);

    expect(row.map((cake) => cake.slug)).toEqual(["mango-gateau"]);
  });
});

describe("the tick is gone from every gate a product field has to pass", () => {
  it("is not on the type", () => {
    expect(code("types/product.ts")).not.toContain("isSeasonal");
  });

  it("is not a Mongoose path, so a document carrying one drops it", async () => {
    const { ProductModel } = await import("@/lib/server/db/models/product.model");
    const doc = new ProductModel({
      _id: "p-log",
      name: "Winter log",
      slug: "winter-log",
      isSeasonal: true,
    });

    const stored = doc.toObject() as { isSeasonal?: boolean };

    expect(stored.isSeasonal).toBeUndefined();
  });

  it("is not a required field the validator rejects a product for omitting", async () => {
    const { productFormSchema } = await import("@/features/products/server/product.validators");

    expect("isSeasonal" in productFormSchema.shape).toBe(false);
  });

  it("is not set on a new product", async () => {
    const { createEmptyProductForm } = await import(
      "@/features/products/lib/products-repository"
    );

    expect("isSeasonal" in createEmptyProductForm()).toBe(false);
  });

  it("is not put back by the read path", async () => {
    const { normalizeCommerceFields } = await import(
      "@/features/products/lib/products-repository"
    );

    expect("isSeasonal" in normalizeCommerceFields(mango)).toBe(false);
  });
});

describe("the admin", () => {
  it("no longer offers the tick", () => {
    expect(code("apps/admin/products/components/product-form-page.tsx")).not.toContain(
      "isSeasonal",
    );
  });

  it("no longer filters the product list by it", () => {
    const list = code("apps/admin/products/components/products-list-page.tsx");

    expect(list).not.toContain("isSeasonal");
    expect(list).not.toContain('value="seasonal"');
  });

  it("does not name it as a product type either", () => {
    // The filter's own type, which is what made the dead option compile.
    expect(code("features/products/lib/product-utils.ts")).toContain(
      'export type ProductTypeFilter = "all" | "photo";',
    );
  });
});
