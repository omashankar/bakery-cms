"use client";

import { useEffect } from "react";

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
    let cancelled = false;

    async function sync() {
      try {
        const products = await fetchProducts();
        if (!cancelled) persistProducts(products);
      } catch {
        // Offline or API down — the existing cache is better than nothing.
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, []);
}
