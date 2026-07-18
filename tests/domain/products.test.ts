/**
 * Characterisation tests for the product repository + storefront mapper seam.
 *
 * These are the files the domain extraction moves out of features/admin, and
 * the mapper is the admin -> storefront boundary. Pin behaviour before moving.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  bulkDeleteProducts,
  bulkUpdateStatus,
  createProduct,
  createEmptyProductForm,
  deleteProduct,
  getProductById,
  getProductBySlug,
  loadProducts,
  updateProduct,
} from "@/features/products/lib/products-repository";
import {
  DEFAULT_PRODUCT_SHAPES,
  getPublishedStorefrontProducts,
  mapAdminProductToStorefront,
} from "@/features/products/lib/product-mapper";
import type { ProductFormData } from "@/types/product";

function form(overrides: Partial<ProductFormData> = {}): ProductFormData {
  return { ...createEmptyProductForm(), name: "Test Cake", slug: "test-cake", ...overrides };
}

beforeEach(() => {
  localStorage.clear();
});

describe("cakes repository", () => {
  it("seeds a non-empty catalog on first load and persists it", () => {
    expect(localStorage.getItem("bakery-cms-admin-cakes")).toBeNull();

    const cakes = loadProducts();

    expect(cakes.length).toBeGreaterThan(0);
    expect(localStorage.getItem("bakery-cms-admin-cakes")).not.toBeNull();
  });

  it("returns a stable catalog across repeated loads", () => {
    expect(loadProducts().map((c) => c.id)).toEqual(loadProducts().map((c) => c.id));
  });

  it("seeds unique slugs", () => {
    const slugs = loadProducts().map((c) => c.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("re-seeds when stored data is corrupt rather than throwing", () => {
    localStorage.setItem("bakery-cms-admin-cakes", "{ not json");

    expect(() => loadProducts()).not.toThrow();
    expect(loadProducts().length).toBeGreaterThan(0);
  });

  it("re-seeds when stored data is an empty array", () => {
    localStorage.setItem("bakery-cms-admin-cakes", "[]");

    expect(loadProducts().length).toBeGreaterThan(0);
  });

  it("creates a cake, prepends it, and makes it findable by id and slug", () => {
    const before = loadProducts().length;
    const created = createProduct(form({ name: "Rose Cake", slug: "rose-cake" }));

    expect(loadProducts()).toHaveLength(before + 1);
    expect(loadProducts()[0].id).toBe(created.id);
    expect(getProductById(created.id)?.name).toBe("Rose Cake");
    expect(getProductBySlug("rose-cake")?.id).toBe(created.id);
  });

  it("stamps createdAt and updatedAt on create", () => {
    const created = createProduct(form({ slug: "stamped" }));

    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBe(created.createdAt);
  });

  it("returns null for unknown ids and slugs", () => {
    expect(getProductById("does-not-exist")).toBeNull();
    expect(getProductBySlug("does-not-exist")).toBeNull();
  });

  it("updates a cake in place, preserving id and createdAt", () => {
    const created = createProduct(form({ slug: "to-update", price: 500 }));

    const updated = updateProduct(created.id, { ...form({ slug: "to-update" }), price: 750 });

    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.price).toBe(750);
    expect(getProductById(created.id)?.price).toBe(750);
  });

  it("returns null when updating a cake that does not exist", () => {
    expect(updateProduct("nope", form())).toBeNull();
  });

  it("deletes a cake and reports whether anything was removed", () => {
    const created = createProduct(form({ slug: "to-delete" }));

    expect(deleteProduct(created.id)).toBe(true);
    expect(getProductById(created.id)).toBeNull();
    expect(deleteProduct("nope")).toBe(false);
  });

  it("bulk-updates status and returns the affected count", () => {
    const a = createProduct(form({ slug: "bulk-a", status: "draft" }));
    const b = createProduct(form({ slug: "bulk-b", status: "draft" }));

    expect(bulkUpdateStatus([a.id, b.id], "published")).toBe(2);
    expect(getProductById(a.id)?.status).toBe("published");
    expect(getProductById(b.id)?.status).toBe("published");
  });

  it("bulk-deletes and returns the affected count", () => {
    const a = createProduct(form({ slug: "bulk-del-a" }));
    const b = createProduct(form({ slug: "bulk-del-b" }));
    const before = loadProducts().length;

    expect(bulkDeleteProducts([a.id, b.id])).toBe(2);
    expect(loadProducts()).toHaveLength(before - 2);
  });

  it("gives a new form sensible bakery defaults", () => {
    const empty = createEmptyProductForm();

    expect(empty.status).toBe("draft");
    expect(empty.shapes).toEqual([...DEFAULT_PRODUCT_SHAPES]);
    expect(empty.variantGroups).toHaveLength(1);
    expect(empty.variantGroups[0].type).toBe("egg");
    expect(empty.allowsMessage).toBe(true);
  });
});

describe("mapAdminProductToStorefront", () => {
  it("carries the commerce fields across the admin -> storefront boundary", () => {
    const cake = createProduct(
      form({ slug: "mapped", name: "Mapped Cake", price: 800, images: ["/a.jpg", "/b.jpg"] })
    );

    const mapped = mapAdminProductToStorefront(cake);

    expect(mapped.id).toBe(cake.id);
    expect(mapped.name).toBe("Mapped Cake");
    expect(mapped.price).toBe(800);
    expect(mapped.image).toBe("/a.jpg"); // first image only
  });

  it("falls back to an empty image and the 'Cakes' category when unresolved", () => {
    const cake = createProduct(form({ slug: "no-image", images: [], categoryId: "missing" }));

    const mapped = mapAdminProductToStorefront(cake);

    expect(mapped.image).toBe("");
    expect(mapped.category).toBe("Cakes");
  });

  it("derives the badge with Featured winning over Bestseller and Trending", () => {
    const base = form({ slug: "badged" });

    expect(
      mapAdminProductToStorefront(
        createProduct({ ...base, slug: "b1", isFeatured: true, isBestSeller: true, isTrending: true })
      ).badge
    ).toBe("Featured");
    expect(
      mapAdminProductToStorefront(
        createProduct({ ...base, slug: "b2", isBestSeller: true, isTrending: true })
      ).badge
    ).toBe("Bestseller");
    expect(mapAdminProductToStorefront(createProduct({ ...base, slug: "b3", isTrending: true })).badge).toBe(
      "Trending"
    );
    expect(mapAdminProductToStorefront(createProduct({ ...base, slug: "b4" })).badge).toBeUndefined();
  });

  it("maps stock status to a boolean inStock", () => {
    const inStock = createProduct(form({ slug: "s1", stockStatus: "in_stock" }));
    const low = createProduct(form({ slug: "s2", stockStatus: "low_stock" }));
    const out = createProduct(form({ slug: "s3", stockStatus: "out_of_stock" }));

    expect(mapAdminProductToStorefront(inStock).inStock).toBe(true);
    expect(mapAdminProductToStorefront(low).inStock).toBe(true);
    expect(mapAdminProductToStorefront(out).inStock).toBe(false);
  });

  it("renames flavourOptions to flavours and omits an empty list", () => {
    const withFlavours = createProduct(form({ slug: "f1", flavourOptions: ["Vanilla"] }));
    const withoutFlavours = createProduct(form({ slug: "f2", flavourOptions: [] }));

    expect(mapAdminProductToStorefront(withFlavours).flavours).toEqual(["Vanilla"]);
    expect(mapAdminProductToStorefront(withoutFlavours).flavours).toBeUndefined();
  });

  it("does not expose isPhotoCake to the storefront at all", () => {
    const cake = createProduct(form({ slug: "p1", isPhotoCake: true }));

    // The storefront re-derives this from allowsPhotoUpload/category instead.
    expect("isPhotoCake" in mapAdminProductToStorefront(cake)).toBe(false);
  });

  it("getPublishedStorefrontProducts returns only published cakes", () => {
    localStorage.setItem("bakery-cms-admin-cakes", "[]");
    const published = createProduct(form({ slug: "pub", status: "published" }));
    createProduct(form({ slug: "draft", status: "draft" }));

    const result = getPublishedStorefrontProducts(loadProducts());

    expect(result.some((c) => c.id === published.id)).toBe(true);
    expect(result.every((c) => c.slug !== "draft")).toBe(true);
  });
});
