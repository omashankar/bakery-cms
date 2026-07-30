/**
 * Client-side admin-config API (admin profile, payment gateways, payment
 * notification prefs, custom code). Whole-blob replace-all dual-write + hydrate.
 * Never throws; every write reports whether the server took it. Admin-guarded endpoints, so reads return null for
 * non-admins. The SEED/first-load is never pushed; only genuine saves are.
 */
interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
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
async function putJson(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const url = (key: string) => `/api/admin-config/${key}`;

export const fetchAdminProfileConfig = () => getJson<Record<string, unknown>>(url("admin-profile"));
export const replaceAdminProfileRequest = (value: unknown) => putJson(url("admin-profile"), value);

export const fetchPaymentGateways = () => getJson<Record<string, unknown>>(url("payment-gateways"));
export const replacePaymentGatewaysRequest = (value: unknown) =>
  putJson(url("payment-gateways"), value);

export const fetchPaymentNotifPrefs = () =>
  getJson<Record<string, unknown>>(url("payment-notif-prefs"));
export const replacePaymentNotifPrefsRequest = (value: unknown) =>
  putJson(url("payment-notif-prefs"), value);

export const fetchCustomCode = () => getJson<{ css: string; js: string }>(url("custom-code"));
export const replaceCustomCodeRequest = (value: { css: string; js: string }) =>
  putJson(url("custom-code"), value);
