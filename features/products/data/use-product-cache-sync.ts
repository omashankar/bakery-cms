"use client";

import { useEffect } from "react";
import { hydrateOnce, markHydrated } from "@/lib/hydrate-once";
import type { Product } from "@/types/product";

import { fetchProducts } from "@/features/products/data/products-client";
import { persistProducts } from "@/features/products/lib/products-repository";

/**
 * Keeps the browser's product cache in step with the server.
 *
 * The server is the source of truth: the storefront renders from it and the
 * admin writes to it through /api/products. But several admin screens still
 * read products synchronously inside `useMemo` (inventory, dashboard, global
 * search, media usage), and a synchronous function cannot fetch.
 *
 * So on entering the admin we pull once and refresh the localStorage copy those
 * readers use. It is a cache, not a second source of truth — nothing reads it
 * for the storefront, and every write still goes to the server.
 *
 * Those screens should eventually fetch for themselves; until then this stops
 * them showing data that is merely whatever this browser last happened to save.
 */
export function useProductCacheSync(): void {
  useEffect(() => {
    void hydrateOnce("products", async () => {
      try {
        const products = await fetchProducts();
        persistProducts(products);
      } catch {
        // Offline or API down — the existing cache is better than nothing.
      }
    });
  }, []);
}

/**
 * The catalogue the SERVER read for this page, applied without a request.
 * Used where a screen draws straight from this cache (Inventory), which on a
 * fresh browser meant the shipped demo stock levels until the fetch landed.
 */
export function applyServerProducts(products: Product[]): void {
  persistProducts(products);
  markHydrated("products");
}
