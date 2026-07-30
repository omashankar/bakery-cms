/**
 * Client-side commerce API (coupons + delivery zones). Whole-collection
 * replace-all dual-write + hydrate. Never throws; every write reports whether the server took it. The SEED is
 * never dual-written (that would clobber the server); only real mutations are.
 */
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

export const fetchCoupons = () => getJson<StoredCoupon[]>("/api/coupons");
export const replaceCouponsRequest = (coupons: StoredCoupon[]) => putJson("/api/coupons", coupons);

export const fetchZones = () => getJson<DeliveryZone[]>("/api/delivery-zones");
export const replaceZonesRequest = (zones: DeliveryZone[]) => putJson("/api/delivery-zones", zones);
