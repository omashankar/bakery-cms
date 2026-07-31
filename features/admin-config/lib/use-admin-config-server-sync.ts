"use client";

import { useEffect } from "react";

import {
  adminConfigHydration,
  fetchAdminProfileConfig,
  fetchPaymentGateways,
  fetchPaymentNotifPrefs,
  fetchCustomCode,
} from "./admin-config-api";
import { persistServerAdminProfile } from "@/apps/admin/profile/lib/admin-profile";
import { persistServerGateways } from "@/features/payments/lib/payment-gateway-settings";
import { persistServerNotifPrefs } from "@/features/payments/lib/notification-prefs";
import { persistServerCustomCode } from "@/apps/admin/settings/lib/custom-code-repository";

/**
 * Hydrates the admin-only config blobs (admin profile, payment gateway runtime,
 * payment notification prefs, custom code) from the server once on entering the
 * admin, so they are durable and consistent across devices. Every genuine save
 * dual-writes back to the server. These endpoints are admin-guarded.
 */
export function useAdminConfigServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [profile, gateways, prefs, code] = await Promise.all([
        fetchAdminProfileConfig(),
        fetchPaymentGateways(),
        fetchPaymentNotifPrefs(),
        fetchCustomCode(),
      ]);
      if (cancelled) return;
      if (profile) persistServerAdminProfile(profile);
      if (gateways) persistServerGateways(gateways);
      if (prefs) persistServerNotifPrefs(prefs);
      if (code) persistServerCustomCode(code);

      // Open the gate only once the local caches actually hold the server's
      // copy. A `null` here is a failed or forbidden read, not an empty config —
      // leaving the gate shut then is what stops a whole-blob write from
      // replacing real settings with this device's defaults.
      if (profile !== null || gateways !== null || prefs !== null || code !== null) {
        adminConfigHydration.markSettled();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
