/**
 * Client-side admin-config API (admin profile, payment gateways, payment
 * notification prefs, custom code). Whole-blob replace-all dual-write + hydrate.
 * Never throws; every write reports whether the server took it. Admin-guarded endpoints, so reads return null for
 * non-admins. The SEED/first-load is never pushed; only genuine saves are.
 */
import { createHydrationGate, type HydrationGate } from "@/lib/hydration-gate";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

export const ADMIN_CONFIG_KEYS = ["admin-profile", "payment-gateways", "payment-notif-prefs", "custom-code"] as const;
export type AdminConfigKey = (typeof ADMIN_CONFIG_KEYS)[number];

/**
 * One gate per blob, each opened when THAT blob has been read from the server.
 * Until then no replace-all write of it may go out.
 *
 * Four blobs shared one gate, and it opened only when all four had arrived. The
 * admin profile is the owner's alone, so for every other member it never did —
 * and a member allowed to change the payment gateways or the custom code had
 * every save refused as "saved on this device only", for a blob they had read
 * perfectly well.
 */
export const adminConfigGates = Object.fromEntries(
  ADMIN_CONFIG_KEYS.map((key) => [key, createHydrationGate()]),
) as Record<AdminConfigKey, HydrationGate>;

/**
 * All four together — for the one screen that needs every blob (Backup), and
 * for code that opens the gates as a whole.
 */
export const adminConfigHydration: HydrationGate = {
  hasSettled: () => ADMIN_CONFIG_KEYS.every((key) => adminConfigGates[key].hasSettled()),
  markSettled: () => ADMIN_CONFIG_KEYS.forEach((key) => adminConfigGates[key].markSettled()),
  waitForSettled: async (timeoutMs) =>
    (await Promise.all(ADMIN_CONFIG_KEYS.map((key) => adminConfigGates[key].waitForSettled(timeoutMs)))).every(Boolean),
};

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether the SERVER accepted the write. Resolves false on a network failure OR
 * a non-2xx response; never throws.
 *
 * This used to be fire-and-forget — it launched the request into a floating
 * async IIFE and returned void, so a 401 from an expired admin token and a 500
 * were both indistinguishable from success. Every caller then reported "saved"
 * for a change that lives only in this browser and that the next hydration
 * silently reverts.
 */
async function putJson(key: AdminConfigKey, body: unknown): Promise<boolean> {
  const path = url(key);
  // Every write here is a whole-blob REPLACE, sent from a local copy. Until that
  // local copy has been filled from the server, sending it overwrites the
  // server's real config with whatever this device happens to hold — and
  // hydration is async, fired once on entering the admin, so an admin who
  // toggles a gateway in the first second sends an empty or partial blob and
  // wipes every other gateway's saved settings.
  //
  // The settings API already learned this (`pushSection` waits on
  // `settingsHydration`); this path never did.
  if (!(await adminConfigGates[key].waitForSettled())) return false;

  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    noteAuthStatus(res.status);
    return res.ok;
  } catch {
    return false;
  }
}

const url = (key: AdminConfigKey) => `/api/admin-config/${key}`;

export const fetchAdminProfileConfig = () => getJson<Record<string, unknown>>(url("admin-profile"));
export const replaceAdminProfileRequest = (value: unknown) => putJson("admin-profile", value);

export const fetchPaymentGateways = () => getJson<Record<string, unknown>>(url("payment-gateways"));
export const replacePaymentGatewaysRequest = (value: unknown) =>
  putJson("payment-gateways", value);

export const fetchPaymentNotifPrefs = () =>
  getJson<Record<string, unknown>>(url("payment-notif-prefs"));
export const replacePaymentNotifPrefsRequest = (value: unknown) =>
  putJson("payment-notif-prefs", value);

export const fetchCustomCode = () => getJson<{ css: string; js: string }>(url("custom-code"));
export const replaceCustomCodeRequest = (value: { css: string; js: string }) =>
  putJson("custom-code", value);
