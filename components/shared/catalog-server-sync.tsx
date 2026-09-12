"use client";

import { useEffect } from "react";

import {
  catalogHydration,
  CATALOG_SECTIONS,
  fetchCatalog,
  setCatalogHydrationStatus,
} from "@/features/catalog/lib/catalog-api";
import {
  loadCatalogStore,
  saveCatalogStore,
} from "@/features/catalog/lib/catalog-repository";
import type { CatalogStore } from "@/types/catalog";

/**
 * Hydrates the local catalog from the server once on mount, so the taxonomy
 * (categories, occasions, collections) the admin and storefront read
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
      if (cancelled) return;

      if (!server) {
        // Say so. The screen was left rendering the shipped defaults as though
        // they were the shop's own, with every button live.
        setCatalogHydrationStatus("unavailable");
        return;
      }

      const current = loadCatalogStore();
      saveCatalogStore(overlayServerSections(current, server));

      // Only NOW may a replace-all mutation send the local taxonomy — before
      // this, it is whatever this browser happened to hold.
      catalogHydration.markSettled();
      setCatalogHydrationStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

/**
 * The server's copy of EVERY section, over the browser's.
 *
 * This was two hand-written lines — `categories: server.categories ??
 * current.categories` and the same for occasions — so adding a section to
 * `CATALOG_SECTIONS` left it out of the overlay. The browser would keep its
 * empty local array, the gate would still mark itself settled, and the next
 * replace-all would publish that emptiness over the shop's real collections.
 * Nothing would log; the section would simply be gone.
 *
 * `?? current[section]` and not `?? []`: a server that omits a section is
 * saying nothing about it, not saying it is empty.
 *
 * Exported and pure so the rule can be tested without a browser.
 */
export function overlayServerSections(
  current: CatalogStore,
  server: Partial<CatalogStore>,
): CatalogStore {
  const merged: Record<string, unknown> = { ...current };
  const from = server as unknown as Record<string, unknown>;
  const fallback = current as unknown as Record<string, unknown>;
  for (const section of CATALOG_SECTIONS) {
    merged[section] = from[section] ?? fallback[section];
  }
  return merged as unknown as CatalogStore;
}
