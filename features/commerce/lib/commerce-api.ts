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

/** Settled by this module's `*ServerSync` once the server's copy is loaded. */
export const commerceHydration = createHydrationGate();

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 */
async function guardedPut(path: string, body: unknown): Promise<boolean> {
  if (!(await commerceHydration.waitForSettled())) return false;
  return putJson(path, body);
}

export const fetchCoupons = () => getJson<StoredCoupon[]>("/api/coupons");
export const replaceCouponsRequest = (coupons: StoredCoupon[]) => guardedPut("/api/coupons", coupons);

export const fetchZones = () => getJson<DeliveryZone[]>("/api/delivery-zones");
export const replaceZonesRequest = (zones: DeliveryZone[]) => guardedPut("/api/delivery-zones", zones);
