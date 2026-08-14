"use client";

import { useEffect } from "react";

import { fetchPages } from "@/features/content/data/pages-client";
import { persistServerPages } from "./pages-repository";

/**
 * Loads the shop's real CMS pages into the browser cache on entering the admin.
 *
 * Nothing did this, so that cache was the four shipped demo pages and nothing
 * else — and the admin's global search read it. Pages the shop had created were
 * unfindable; pages it had deleted still turned up in the results and navigated
 * to an editor that bounced back with "Page not found". Every other admin store
 * in this shell already hydrates the same way.
 */
export function usePagesServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pages = await fetchPages();
        if (!cancelled) persistServerPages(pages);
      } catch {
        // A failed hydration leaves the previous cache in place; global search
        // is not worth a toast.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
