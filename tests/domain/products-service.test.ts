/**
 * Tests for the async server product store + service.
 *
 * The store now sits on MongoDB (product.repository). To keep these unit tests
 * hermetic — no live database — the repository is mocked with an in-memory
 * backing. That still exercises everything the SERVICE owns: seeding, the
 * mutate-under-lock queue, id/slug lookups, and the storefront projections.
 * The Mongo adapter's own concerns (persistence, atomic writes) are the
 * repository's to prove, not this file's.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the Mongo-backed product repository.
vi.mock("@/features/products/server/product.repository", async () => {
  const { seedProducts } = await import("@/features/products/lib/products-repository");
  let store: import("@/types/product").Product[] | null = null;

  return {
    async listAll() {
      if (store === null) store = seedProducts();
      return store;
    },
    async replaceAll(products: import("@/types/product").Product[]) {
      store = [...products];
    },
    async reset() {
      store = null;
    },
    async findById(id: string) {
      return (store ?? []).find((p) => p.id === id) ?? null;
    },
    async findBySlug(slug: string) {
      return (store ?? []).find((p) => p.slug === slug) ?? null;
    },
    async slugExists(slug: string, exceptId?: string) {
      return (store ?? []).some((p) => p.slug === slug && p.id !== exceptId);
    },
  };
});

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

function form(overrides: Partial<ProductFormData> = {}): ProductFormData {
  return { ...createEmptyProductForm(), name: "Test Cake", slug: "test-cake", ...overrides };
}

beforeEach(async () => {
  await resetProductStore();
});

describe("the store seeds itself", () => {
  it("returns a non-empty catalogue on first read", async () => {
    const products = await getProducts();
    expect(products.length).toBeGreaterThan(0);
  });

  it("returns a stable catalogue across reads", async () => {
    const first = await getProducts();
    const second = await getProducts();
    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));
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

  it("survives a fresh read — the write actually persisted", async () => {
    const created = await createProduct(form({ slug: "durable", name: "Durable" }));
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
