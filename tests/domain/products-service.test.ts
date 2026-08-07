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
//
// It models the two things that matter about the real one: writes address a
// SINGLE document, and the slug is unique in the database rather than checked in
// JS beforehand. A mock that accepted a duplicate slug would let the service
// look correct while the real collection refused the write.
vi.mock("@/features/products/server/product.repository", async () => {
  const { seedProducts } = await import("@/features/products/lib/products-repository");
  type P = import("@/types/product").Product;
  let store: P[] | null = null;

  const rows = () => {
    if (store === null) store = seedProducts();
    return store;
  };

  const duplicateSlug = (slug: string, exceptId?: string) => {
    if (!rows().some((p) => p.slug === slug && p.id !== exceptId)) return null;
    const error = new Error(`E11000 duplicate key error collection: products index: slug_1`);
    (error as unknown as { code: number; keyPattern: Record<string, number> }).code = 11000;
    (error as unknown as { keyPattern: Record<string, number> }).keyPattern = { slug: 1 };
    return error;
  };

  return {
    async listAll() {
      return rows();
    },
    async insertOne(product: P) {
      const clash = duplicateSlug(product.slug);
      if (clash) throw clash;
      // The real repository sorts newest-first, so a new product leads the list.
      store = [product, ...rows()];
      return product;
    },
    async replaceOne(id: string, product: P) {
      const list = rows();
      const index = list.findIndex((p) => p.id === id);
      if (index === -1) return null;
      const clash = duplicateSlug(product.slug, id);
      if (clash) throw clash;
      list[index] = product;
      return product;
    },
    async deleteOne(id: string) {
      const list = rows();
      const next = list.filter((p) => p.id !== id);
      store = next;
      return next.length !== list.length;
    },
    async setStatusMany(ids: string[], status: P["status"]) {
      let updated = 0;
      store = rows().map((p) => {
        if (!ids.includes(p.id)) return p;
        updated += 1;
        return { ...p, status };
      });
      return updated;
    },
    async setReviewAggregate() {},
    async replaceAll(products: P[]) {
      store = [...products];
    },
    async reset() {
      store = null;
    },
    async findById(id: string) {
      return rows().find((p) => p.id === id) ?? null;
    },
    async findBySlug(slug: string) {
      return rows().find((p) => p.slug === slug) ?? null;
    },
    async slugExists(slug: string, exceptId?: string) {
      return rows().some((p) => p.slug === slug && p.id !== exceptId);
    },
    isDuplicateSlugError(error: unknown) {
      return error instanceof Error && error.message.includes("E11000");
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

  it("does not lose concurrent writes", async () => {
    // Concurrency safety used to come from an in-process queue around a
    // read-all/write-all cycle. It now comes from each write addressing one
    // document, which also protects against the writers that were never IN that
    // queue — order placement and stock adjustments.
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

  it("refuses a duplicate slug at the database, not with a prior scan", async () => {
    await createProduct(form({ slug: "taken", name: "First" }));
    // A scan-then-write is a check two requests can both pass. The slug is the
    // storefront's product URL, so a collision leaves one cake unreachable.
    await expect(createProduct(form({ slug: "taken", name: "Second" }))).rejects.toThrow(
      /E11000/,
    );
  });

  it("does not let an edit form write back the review aggregate", async () => {
    const created = await createProduct(form({ slug: "rated", name: "Rated" }));

    // The reviews aggregate owns these and writes them directly. A form opened
    // before a moderation decision would otherwise carry the old figures back
    // and undo it.
    const updated = await updateProduct(created.id, {
      ...form({ slug: "rated" }),
      rating: 4.9,
      reviewCount: 124,
    } as ProductFormData);

    expect(updated?.rating).toBe(created.rating);
    expect(updated?.reviewCount).toBe(created.reviewCount);
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
