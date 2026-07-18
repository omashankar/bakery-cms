/**
 * Tests for the async server product store + service.
 *
 * This is the seam the real database will replace. These tests pin the contract
 * the DB adapter must honour, so the swap can be verified rather than hoped for.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductBySlug,
  getProducts,
  getStorefrontProductBySlug,
  getStorefrontProductCards,
  getStorefrontProducts,
  updateProduct,
} from "@/features/products/data/products-service";
import { resetProductStore } from "@/features/products/data/products-store.server";
import { createEmptyProductForm } from "@/features/products/lib/products-repository";
import type { ProductFormData } from "@/types/product";

const DATA_PATH = path.join(process.cwd(), ".data", "products.json");

function form(overrides: Partial<ProductFormData> = {}): ProductFormData {
  return { ...createEmptyProductForm(), name: "Test Cake", slug: "test-cake", ...overrides };
}

beforeEach(async () => {
  await resetProductStore();
});

afterEach(async () => {
  await resetProductStore();
});

describe("the store seeds itself", () => {
  it("creates the file on first read and returns a non-empty catalogue", async () => {
    await expect(fs.access(DATA_PATH)).rejects.toThrow();

    const products = await getProducts();

    expect(products.length).toBeGreaterThan(0);
    await expect(fs.access(DATA_PATH)).resolves.toBeUndefined();
  });

  it("returns a stable catalogue across reads", async () => {
    const first = await getProducts();
    const second = await getProducts();

    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));
  });

  it("re-seeds instead of throwing when the file is corrupt", async () => {
    await getProducts();
    await fs.writeFile(DATA_PATH, "{ not json", "utf8");

    const products = await getProducts();

    expect(products.length).toBeGreaterThan(0);
  });

  it("re-seeds when the file holds an empty array", async () => {
    await getProducts();
    await fs.writeFile(DATA_PATH, "[]", "utf8");

    expect((await getProducts()).length).toBeGreaterThan(0);
  });
});

describe("reads", () => {
  it("finds a product by id and by slug", async () => {
    const created = await createProduct(form({ slug: "find-me", name: "Find Me" }));

    expect((await getProductById(created.id))?.name).toBe("Find Me");
    expect((await getProductBySlug("find-me"))?.id).toBe(created.id);
  });

  it("returns null for unknown id and slug", async () => {
    expect(await getProductById("nope")).toBeNull();
    expect(await getProductBySlug("nope")).toBeNull();
  });
});

describe("writes persist to the store", () => {
  it("creates a product and puts it at the front", async () => {
    const before = (await getProducts()).length;
    const created = await createProduct(form({ slug: "brand-new", name: "Brand New" }));

    const after = await getProducts();
    expect(after).toHaveLength(before + 1);
    expect(after[0].id).toBe(created.id);
  });

  it("survives a fresh read — the write actually hit disk", async () => {
    const created = await createProduct(form({ slug: "durable", name: "Durable" }));

    // No in-memory cache to hide behind: this re-reads the file.
    expect((await getProductBySlug("durable"))?.id).toBe(created.id);
  });

  it("updates in place, preserving id and createdAt", async () => {
    const created = await createProduct(form({ slug: "to-update", price: 500 }));

    const updated = await updateProduct(created.id, { ...form({ slug: "to-update" }), price: 750 });

    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect((await getProductById(created.id))?.price).toBe(750);
  });

  it("returns null when updating something that does not exist", async () => {
    expect(await updateProduct("nope", form())).toBeNull();
  });

  it("deletes and reports whether anything was removed", async () => {
    const created = await createProduct(form({ slug: "to-delete" }));

    expect(await deleteProduct(created.id)).toBe(true);
    expect(await getProductById(created.id)).toBeNull();
    expect(await deleteProduct(created.id)).toBe(false);
  });

  it("does not interleave concurrent writes", async () => {
    const before = (await getProducts()).length;

    await Promise.all([
      createProduct(form({ slug: "c1", name: "C1" })),
      createProduct(form({ slug: "c2", name: "C2" })),
      createProduct(form({ slug: "c3", name: "C3" })),
    ]);

    const slugs = (await getProducts()).map((p) => p.slug);
    expect(slugs).toContain("c1");
    expect(slugs).toContain("c2");
    expect(slugs).toContain("c3");
    expect(await getProducts()).toHaveLength(before + 3);
  });
});

describe("storefront projections", () => {
  it("exposes only published products", async () => {
    await createProduct(form({ slug: "pub-1", status: "published" }));
    await createProduct(form({ slug: "draft-1", status: "draft" }));

    const slugs = (await getStorefrontProducts()).map((p) => p.slug);

    expect(slugs).toContain("pub-1");
    expect(slugs).not.toContain("draft-1");
  });

  it("hides a draft product from the storefront detail lookup", async () => {
    await createProduct(form({ slug: "hidden", status: "draft" }));

    expect(await getStorefrontProductBySlug("hidden")).toBeNull();
  });

  it("card projection drops the heavy fields but keeps what a card renders", async () => {
    await createProduct(
      form({
        slug: "card-me",
        name: "Card Me",
        status: "published",
        price: 800,
        description: "A very long description that no card ever displays",
      })
    );

    const card = (await getStorefrontProductCards()).find((p) => p.slug === "card-me");

    expect(card).toBeDefined();
    expect(card?.name).toBe("Card Me");
    expect(card?.price).toBe(800);
    // Dropped to keep the RSC payload small.
    expect(card?.description).toBe("");
    expect(card?.variantGroups).toBeUndefined();
    expect(card?.weights).toBeUndefined();
  });
});
