"use client";

import { useEffect } from "react";

import {
  couponsHydration,
  fetchCoupons,
  fetchZones,
  zonesHydration,
} from "@/features/commerce/lib/commerce-api";
import { persistServerCoupons } from "@/features/commerce/lib/coupons-repository";
import { persistServerZones } from "@/features/commerce/lib/delivery-zones-repository";

/**
 * Hydrates coupons + delivery zones from the server once on mount, so the
 * storefront (checkout) and admin both read the durable server collections
 * instead of a per-browser seed. Reads are public. After hydration the local
 * cache matches the server, so admin mutations safely dual-write replace-all.
 */
export function CommerceServerSync() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [coupons, zones] = await Promise.all([fetchCoupons(), fetchZones()]);
      if (cancelled) return;
      if (coupons) persistServerCoupons(coupons);
      if (zones) persistServerZones(zones);

      // Each store waits on its OWN read.
      //
      // One shared gate needed BOTH to succeed, so a coupons outage blocked
      // every zone save — and the admin was told "the server rejected it" for a
      // request the server never received. The two lists have nothing to do with
      // each other; only the read that fills a list can vouch for writing it.
      if (coupons) couponsHydration.markSettled();
      if (zones) zonesHydration.markSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
