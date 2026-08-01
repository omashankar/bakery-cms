/**
 * Client-side commerce API (coupons + delivery zones). Whole-collection
 * replace-all dual-write + hydrate. Never throws; every write reports whether the server took it. The SEED is
 * never dual-written (that would clobber the server); only real mutations are.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type { StoredCoupon } from "./coupons-repository";
import type { DeliveryZone } from "@/types/delivery";

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

/**
 * One gate per LIST, not one for the module.
 *
 * A single shared gate needed both reads to succeed before either list could be
 * written, so a coupons outage blocked zone saves — and the admin was told the
 * server had rejected a request it never received. A gate can only vouch for the
 * list its own read filled.
 *
 */
export const couponsHydration = createHydrationGate();
export const zonesHydration = createHydrationGate();

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 */
async function guardedPut(
  gate: { waitForSettled: (ms?: number) => Promise<boolean> },
  path: string,
  body: unknown,
): Promise<boolean> {
  if (!(await gate.waitForSettled())) return false;
  return putJson(path, body);
}

export const fetchCoupons = () => getJson<StoredCoupon[]>("/api/coupons");
export const replaceCouponsRequest = (coupons: StoredCoupon[]) => guardedPut(couponsHydration, "/api/coupons", coupons);

export const fetchZones = () => getJson<DeliveryZone[]>("/api/delivery-zones");
/**
 * `knownIds` is what this browser believed existed before the edit.
 *
 * Without it a replace-all asserts "these are all the zones", so a stale tab
 * deletes everything another device has created since.
 */
export const replaceZonesRequest = (zones: DeliveryZone[], knownIds?: string[]) =>
  guardedPut(zonesHydration, "/api/delivery-zones", knownIds ? { zones, knownIds } : zones);

/**
 * A backup restore, which genuinely means "make the server look like this".
 *
 * `replaceZonesRequest` without `knownIds` deletes nothing — the safe reading for
 * an ordinary save from a possibly-stale tab, and the wrong one here: a restore
 * that cannot remove a zone silently leaves rows the backup does not contain,
 * and reported success. So the CURRENT server ids are read first and sent as the
 * known set, which is exactly the claim a restore is entitled to make.
 */
export async function restoreZonesRequest(zones: DeliveryZone[]): Promise<boolean> {
  const current = await fetchZones();
  if (current === null) return false;
  return replaceZonesRequest(zones, current.map((zone) => zone.id));
}
