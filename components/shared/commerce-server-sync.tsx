"use client";

import { useEffect } from "react";

import { commerceHydration, fetchCoupons, fetchZones } from "@/features/commerce/lib/commerce-api";
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

      // Only NOW may a replace-all mutation send the local list — before this,
      // that list is whatever this browser happened to hold.
      if (coupons && zones) commerceHydration.markSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
