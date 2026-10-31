"use client";

import {
  ADMIN_CONFIG_KEYS,
  adminConfigGates,
  fetchAdminProfileConfig,
  fetchCustomCode,
  fetchPaymentGateways,
  fetchPaymentNotifPrefs,
  type AdminConfigKey,
} from "./admin-config-api";
import {
  persistServerAccount,
  persistServerAdminProfile,
} from "@/features/auth/lib/admin-profile";
import { fetchCurrentUser } from "@/features/auth/lib/auth-api";
import { persistServerGateways } from "@/features/payments/lib/payment-gateway-settings";
import { persistServerNotifPrefs } from "@/features/payments/lib/notification-prefs";
import { persistServerCustomCode } from "@/features/settings/lib/custom-code-repository";

/**
 * Opens the admin-config gates, on demand and honestly.
 *
 * Four separate blobs — the admin profile, the payment gateway runtime, the
 * payment notification preferences and the custom CSS/JS — each with its own
 * gate, opened only by its OWN read. A save of one waits on that one alone, so
 * a blob that failed to load (or that this member may not read — the profile
 * is the owner's) blocks nothing but itself. A gate opened by a different
 * blob's read would vouch for a cache never filled from the server, and a
 * save would push this browser's seed over the shop's real values.
 *
 * Callable rather than mount-only for the same reason as the other gates: the
 * sync runs from a `[]`-dep effect that never re-runs after an in-app login.
 */

const STORE: Record<AdminConfigKey, { fetch: () => Promise<unknown>; persist: (value: never) => void }> = {
  "admin-profile": { fetch: fetchAdminProfileConfig, persist: persistServerAdminProfile },
  "payment-gateways": { fetch: fetchPaymentGateways, persist: persistServerGateways },
  "payment-notif-prefs": { fetch: fetchPaymentNotifPrefs, persist: persistServerNotifPrefs },
  "custom-code": { fetch: fetchCustomCode, persist: persistServerCustomCode },
};

function adopt(key: AdminConfigKey, value: unknown): void {
  if (value === null || value === undefined) return;
  STORE[key].persist(value as never);
  adminConfigGates[key].markSettled();
}

/**
 * What the reads below return, as the SERVER made them for an admin page,
 * applied without a request — the same writes, then each blob's own gate.
 */
export function applyServerAdminConfig(read: {
  /**
   * Each null when THIS member may not read it (see admin-config-rules) — the
   * profile is the owner's own. Only what arrived is stored and only its gate
   * opens: a null taken for "nothing saved" would let a save push this
   * browser's seed over the shop's real values.
   */
  profile: Record<string, unknown> | null;
  gateways: Record<string, unknown> | null;
  prefs: Record<string, unknown> | null;
  code: { css: string; js: string } | null;
  account: Record<string, unknown> | null;
}): void {
  adopt("admin-profile", read.profile);
  persistServerAccount(read.account);
  adopt("payment-gateways", read.gateways);
  adopt("payment-notif-prefs", read.prefs);
  adopt("custom-code", read.code);
}

/**
 * Reads the blobs named (every one by default) that are not loaded yet, and
 * opens each gate whose read succeeded. True when every blob named is loaded.
 *
 * The admin shell names only the blobs this member may read, so a member is
 * not sent four requests to collect three refusals on every page.
 */
export async function ensureAdminConfigHydrated(
  keys: readonly AdminConfigKey[] = ADMIN_CONFIG_KEYS,
): Promise<boolean> {
  const missing = keys.filter((key) => !adminConfigGates[key].hasSettled());
  if (missing.length === 0) return true;

  const values = await Promise.all(missing.map((key) => STORE[key].fetch()));
  missing.forEach((key, index) => adopt(key, values[index]));

  // The account fields the profile screen used to invent: the email (whose
  // fallback was a hardcoded personal address) and the created / last-login
  // dates it seeded and then pushed back as fact. Not part of any gate: these
  // are read-only, so a failed read leaves them blank rather than blocking a
  // save.
  if (missing.includes("admin-profile")) persistServerAccount(await fetchCurrentUser());

  return keys.every((key) => adminConfigGates[key].hasSettled());
}
