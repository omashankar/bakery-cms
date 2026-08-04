"use client";

import {
  adminConfigHydration,
  fetchAdminProfileConfig,
  fetchCustomCode,
  fetchPaymentGateways,
  fetchPaymentNotifPrefs,
} from "./admin-config-api";
import { persistServerAdminProfile } from "@/apps/admin/profile/lib/admin-profile";
import { persistServerGateways } from "@/features/payments/lib/payment-gateway-settings";
import { persistServerNotifPrefs } from "@/features/payments/lib/notification-prefs";
import { persistServerCustomCode } from "@/apps/admin/settings/lib/custom-code-repository";

/**
 * Opens the admin-config gate, on demand and honestly.
 *
 * One gate vouches for FOUR separate blobs — the admin profile, the payment
 * gateway runtime, the payment notification preferences and the custom
 * CSS/JS — and the sync component opened it when ANY ONE of them loaded:
 *
 *     if (profile !== null || gateways !== null || prefs !== null || code !== null)
 *
 * So a run where the profile arrived and the custom-code read failed opened the
 * gate for custom code too, and a save from that screen then pushed this
 * browser's cache — the demo seed on a cold load — over the shop's real
 * injected CSS and JS. Every one has to arrive, or the gate stays shut and the
 * write reports "saved on this device only", which is the recoverable outcome.
 *
 * Callable rather than mount-only for the same reason as the other gates: the
 * sync runs from a `[]`-dep effect that never re-runs after an in-app login.
 */
export async function ensureAdminConfigHydrated(): Promise<boolean> {
  if (adminConfigHydration.hasSettled()) return true;

  const [profile, gateways, prefs, code] = await Promise.all([
    fetchAdminProfileConfig(),
    fetchPaymentGateways(),
    fetchPaymentNotifPrefs(),
    fetchCustomCode(),
  ]);

  if (profile) persistServerAdminProfile(profile);
  if (gateways) persistServerGateways(gateways);
  if (prefs) persistServerNotifPrefs(prefs);
  if (code) persistServerCustomCode(code);

  if (!profile || !gateways || !prefs || !code) return false;

  adminConfigHydration.markSettled();
  return true;
}
