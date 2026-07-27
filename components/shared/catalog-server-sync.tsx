"use client";

import { useEffect } from "react";

import { fetchCatalog } from "@/features/catalog/lib/catalog-api";
import {
  loadCatalogStore,
  saveCatalogStore,
} from "@/features/catalog/lib/catalog-repository";

/**
 * Hydrates the local catalog from the server once on mount, so the taxonomy
 * (categories, flavours, occasions, weights) the admin and storefront read
 * reflects the durable server state, not a stale per-browser copy.
 *
 * The catalog read is public, so this runs for everyone. Server values replace
 * the local ones per section; a section the server omits keeps its existing
 * value. `saveCatalogStore` does not dual-write, so there is no sync loop.
 */
export function CatalogServerSync() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const server = await fetchCatalog();
      if (!server || cancelled) return;

      const current = loadCatalogStore();
      saveCatalogStore({
        ...current,
        categories: server.categories ?? current.categories,
        flavours: server.flavours ?? current.flavours,
        occasions: server.occasions ?? current.occasions,
        weights: server.weights ?? current.weights,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
