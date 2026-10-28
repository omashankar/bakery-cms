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
 * - `radius`   — a circle on the map: `center` and `radiusKm`
 * - `polygon`  — a boundary drawn on the map: `polygon`
 *
 * A zone saved before this existed has no `coverage`, and keeps the rule it
 * was written under: its single `pincode` (exact or prefix), else its `city`.
 *
 * ONLY THE MAP AREAS DECIDE DELIVERY (owner, 2026-10-27). A customer pins
 * their door on a map at checkout and the server asks which area holds that
 * point; a PIN proves nothing about where the cake goes ("Kota address,
 * Sangod PIN"). Zones of the other kinds are kept, shown as needing an area,
 * and make no address deliverable.
 */
export type DeliveryZoneCoverage =
  | "country"
  | "states"
  | "cities"
  | "pincodes"
  | "radius"
  | "polygon"
  | "areas";

/**
 * One shape of a zone that covers several (`coverage: "areas"`) — Talwandi,
 * Mahaveer Nagar and Vigyan Nagar at one price, as one zone rather than three
 * copies of the same charge and days.
 */
export type ZoneArea =
  | { kind: "radius"; center: LatLng; radiusKm: number }
  | { kind: "polygon"; polygon: LatLng[] };

/** A point on the map, in degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Where the customer put the pin for their door. Sent by the browser and so
 * never trusted: the server checks it against the zones, and asks the map
 * what is there, before an order is priced.
 */
export interface DeliveryPin extends LatLng {
  /** An id for the suggestion it came from, when one was picked. Kept for the record only. */
  placeId?: string;
}

/**
 * What the SERVER found at the pin, stored with the order's totals — written
 * by the shop, so the admin can rely on it, unlike the address the browser sent.
 */
export interface DeliveryPinVerification extends LatLng {
  /**
   * India Post's PIN at the pin, from its nearest post offices (before
   * 2026-10-28: OpenStreetMap's); null where no post office is near.
   */
  postalCode: string | null;
  /**
   * How the typed PIN fared: `matched` the PIN at the pin; `nearby` (another
   * PIN close by, or in the same district — a PIN line is nobody's map);
   * `not-on-map` (no post office near the pin); `unavailable` (neither the
   * map nor a post office could say). The area check passed in every case.
   */
  pincodeCheck: "matched" | "nearby" | "not-on-map" | "unavailable";
  formattedAddress: string;
  zoneId: string;
  verifiedAt: string;
}

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
  /** For `radius`: the middle of the circle — usually the shop. */
  center?: LatLng;
  /** For `polygon`: the boundary's corners, in order; at least three. */
  polygon?: LatLng[];
  /** For `areas`: every circle and boundary the zone covers, in the order drawn. */
  areas?: ZoneArea[];
  /** For `radius`: how far from `center`, in km. Unused by every other kind. */
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
  /**
   * "Talwandi", "Vigyan Nagar" … — at most five, towns first. For showing, and
   * for checking a street against its PIN (address-pincode-check.ts); never
   * for choosing a zone.
   */
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
  matchType: "pincode" | "city" | "state" | "country" | "area";
}

export type DeliveryZoneStatusFilter = "all" | "active" | "inactive";

/**
 * What a zone is drawn as, for the list's filter: on the map, whole
 * districts, whole states — or a PIN-era zone that decides nothing until it
 * is given one of those (`needs-area`).
 */
export type DeliveryZoneKindFilter = "all" | "map" | "districts" | "states" | "needs-area";

export interface DeliveryZoneListFilters {
  search: string;
  status: DeliveryZoneStatusFilter;
  kind: DeliveryZoneKindFilter;
}

export const defaultDeliveryZoneFilters: DeliveryZoneListFilters = {
  search: "",
  status: "all",
  kind: "all",
};
