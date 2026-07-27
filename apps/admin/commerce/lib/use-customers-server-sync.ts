"use client";

import { useEffect } from "react";

import { fetchCustomerMetaMap } from "./customers-api";
import { persistServerCustomerMeta } from "./customers-repository";

/**
 * Hydrates admin-managed customer metadata (tags/notes/marketing) from the
 * server once on entering the admin. Customer records themselves derive from
 * orders (already hydrated); this fills in the durable admin layer.
 */
export function useCustomersServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const map = await fetchCustomerMetaMap();
      if (!cancelled && map) persistServerCustomerMeta(map);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
