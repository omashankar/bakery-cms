import { createJsonStore } from "@/lib/server/json-store";
import {
  normalizeCommerceFields,
  seedProducts,
} from "@/features/products/lib/products-repository";
import type { Product } from "@/types/product";

/**
 * Server-side product store — the seam the real database will replace.
 *
 * Locking, atomic writes and seeding live in createJsonStore; this file only
 * says what a product store is made of.
 */
const store = createJsonStore<Product[]>({
  file: "products.json",
  seed: seedProducts,
  isValid: (products) => Array.isArray(products) && products.length > 0,
  normalize: (products) => products.map(normalizeCommerceFields),
});

export const readProducts = store.read;
export const saveProducts = store.write;
export const mutateProducts = store.mutate;

/** Test helper: drop the store so the next read re-seeds. */
export const resetProductStore = store.reset;
