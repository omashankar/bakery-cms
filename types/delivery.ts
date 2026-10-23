import type { BaseEntity } from "./common";

/**
 * WHAT A ZONE COVERS.
 *
 * - `country`  — everywhere the shop delivers in India
 * - `states`   — whole states, decided from the PIN code (see india-states.ts)
 * - `cities`   — named cities, matched on the address's city
 * - `pincodes` — chosen PIN codes or areas: an exact 6-digit PIN, or a
 *                prefix ("3240" is every PIN starting 3240)
 *
 * A zone saved before this existed has no `coverage`, and keeps the rule it
 * was written under: its single `pincode` (exact or prefix), else its `city`.
 */
export type DeliveryZoneCoverage = "country" | "states" | "cities" | "pincodes";

export interface DeliveryZone extends BaseEntity {
  name: string;
  /** The single city of a zone written before `coverage`; also shown in lists. */
  city: string;
  /** The single PIN rule of a zone written before `coverage`. */
  pincode: string;
  coverage?: DeliveryZoneCoverage;
  /** For `states`: names from `INDIAN_STATES`. */
  states?: string[];
  /** For `cities`. */
  cities?: string[];
  /** For `pincodes`: exact PINs or prefixes. */
  pincodes?: string[];
  /**
   * PINs (or prefixes) the zone LEAVES OUT, whatever it covers — "all of
   * Rajasthan except 3420", "Kota but not 324009".
   */
  excludedPincodes?: string[];
  radiusKm: number;
  deliveryCharge: number;
  minDeliveryDays: number;
  estimatedDeliveryDays: number;
  isActive: boolean;
  priority: number;
}

export type DeliveryZoneFormData = Omit<DeliveryZone, "id" | "createdAt" | "updatedAt">;

/**
 * WHAT INDIA POST SAYS IS AT A PIN CODE — its state, the district(s) it lies
 * in, and the post-office areas inside it. Read on the server from the
 * directory (features/commerce/server/pincode-directory.ts); a browser gets
 * it from /api/pincodes.
 */
export interface PincodePlace {
  pincode: string;
  state: string;
  /** Usually one; a PIN on a district line lists each. */
  districts: string[];
  /** "Talwandi", "Vigyan Nagar" … — for showing, never for matching. */
  areas: string[];
}

/** A 3–5 digit PIN prefix, summed up from the real PINs that start with it. */
export interface PincodePrefixSummary {
  prefix: string;
  /** How many real PIN codes start with it — 0 means a typo. */
  count: number;
  districts: string[];
  states: string[];
}

export type PincodeInfo =
  | { kind: "pin"; code: string; /** Null: India Post lists no such PIN. */ place: PincodePlace | null }
  | { kind: "prefix"; code: string; summary: PincodePrefixSummary };

export interface DistrictEntry {
  name: string;
  state: string;
  pins: number;
}

export interface DeliveryZoneMatch {
  zone: DeliveryZone;
  matchType: "pincode" | "city" | "state" | "country";
}

export type DeliveryZoneStatusFilter = "all" | "active" | "inactive";

export interface DeliveryZoneListFilters {
  search: string;
  status: DeliveryZoneStatusFilter;
  city: string;
}

export const defaultDeliveryZoneFilters: DeliveryZoneListFilters = {
  search: "",
  status: "all",
  city: "all",
};
