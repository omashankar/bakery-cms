/**
 * Client-side commerce API (coupons + delivery zones). Whole-collection
 * replace-all dual-write + hydrate. Best-effort — never throws. The SEED is
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

function putJson(path: string, body: unknown): void {
  void (async () => {
    try {
      await fetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // best-effort
    }
  })();
}

export const fetchCoupons = () => getJson<StoredCoupon[]>("/api/coupons");
export const replaceCouponsRequest = (coupons: StoredCoupon[]) => putJson("/api/coupons", coupons);

export const fetchZones = () => getJson<DeliveryZone[]>("/api/delivery-zones");
export const replaceZonesRequest = (zones: DeliveryZone[]) => putJson("/api/delivery-zones", zones);
