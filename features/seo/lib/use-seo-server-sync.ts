"use client";

import { useEffect } from "react";

import { fetchSeoStore } from "@/features/site-layout/lib/site-layout-api";
import { persistServerSeo } from "./seo-repository";

/**
 * Hydrates the SEO store (global settings + per-route entries) from the server
 * once on entering the admin, so SEO edits are durable and visible across
 * devices. Admin mutations dual-write the whole store back to the server.
 */
export function useSeoServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const store = await fetchSeoStore();
      if (!cancelled && store) persistServerSeo(store);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
