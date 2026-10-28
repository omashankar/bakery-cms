import type {
  DeliveryZone,
  DeliveryZoneKindFilter,
  DeliveryZoneListFilters,
  DeliveryZoneMatch,
  PincodePlace,
} from "@/types/delivery";
import { matchStateName, stateForPincode } from "./india-states";

/**
 * What a customer is told when no zone holds their map pin and the shop stops
 * there. About the LOCATION, not the PIN: the pin decides now.
 */
export const OUTSIDE_ZONES_MESSAGE =
  "This location is outside our delivery area. Please select an eligible delivery address.";

export function normalizePincode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** A complete Indian PIN code: six digits, never starting with 0. */
export function isFullPincode(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value);
}

export function matchesZonePincode(zonePincode: string, addressPincode: string): boolean {
  const zone = normalizePincode(zonePincode);
  const address = normalizePincode(addressPincode);
  if (!zone || !address) return false;
  if (zone.length === 6) return zone === address;
  return address.startsWith(zone);
}

const foldName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function matchesZoneCity(zoneCity: string, addressCity: string): boolean {
  return foldName(zoneCity) === foldName(addressCity);
}

/**
 * An address as the zones read it. `place` is what India Post says is at the
 * PIN (see pincode-directory.ts) — when it is known, the REAL state and
 * district decide, and what the customer typed in City and State does not.
 */
export interface ZoneAddress {
  city?: string;
  pincode?: string;
  state?: string;
  place?: Pick<PincodePlace, "state" | "districts"> | null;
}

/** The PIN rules a zone answers to: its list, or the single rule of an older zone. */
export function zonePincodeRules(zone: DeliveryZone): string[] {
  const rules = zone.coverage ? (zone.pincodes ?? []) : [zone.pincode];
  return rules.map(normalizePincode).filter(Boolean);
}

/** The cities a zone answers to: its list, or the single city of an older zone. */
export function zoneCities(zone: DeliveryZone): string[] {
  const cities = zone.coverage ? (zone.cities ?? []) : [zone.city];
  return cities.map((city) => city.trim()).filter(Boolean);
}

/** The longest of `rules` that `pincode` falls under, or 0 for none. */
function longestPincodeRule(rules: string[], pincode: string): number {
  let best = 0;
  for (const rule of rules) {
    if (matchesZonePincode(rule, pincode)) best = Math.max(best, rule.length);
  }
  return best;
}

/** Whether the zone's "leave out" list names this PIN. */
export function zoneExcludesPincode(zone: DeliveryZone, pincode: string): boolean {
  if (!pincode) return false;
  return (zone.excludedPincodes ?? [])
    .map(normalizePincode)
    .some((rule) => rule && matchesZonePincode(rule, pincode));
}

interface ZoneHit {
  zone: DeliveryZone;
  /**
   * How narrowly the zone was matched — the first sort key. A PIN rule is
   * 100 + its length (an exact PIN beats a prefix), a city 50–51, a state 30,
   * the whole country 10.
   */
  rank: number;
  /** For PIN hits only: the address's city agrees with the zone's. */
  cityAgrees: number;
  matchType: DeliveryZoneMatch["matchType"];
}

/**
 * Find the best active delivery zone for an address.
 *
 * Order of preference, most specific first:
 *   1. the narrowest rule that matches — an exact 6-digit PIN beats a 4-digit
 *      prefix, which beats a 2-digit one; any PIN rule beats a city, a city
 *      beats a state, and a state beats the whole country
 *   2. then whether the zone's city agrees, to settle two PIN rules of equal
 *      precision
 *   3. then the admin's explicit priority
 *   4. then the cheaper charge, so a tie never costs the customer more
 *   5. then the id, so the answer is the same on both sides of the wire
 *
 * A zone whose "leave out" list names the address's PIN does not match at all.
 *
 * Specificity has to come first. Sorting by priority alone meant that two zones
 * left on the default priority — which is what the form creates — were separated
 * only by price, so a broad "56" prefix zone at ₹40 silently outbid the exact
 * "560034" zone the admin had just created for that address at ₹60. The narrower
 * rule is the one the admin wrote deliberately — and the same holds one level
 * up: "all of Rajasthan at ₹150" must not outbid the Kota zone at ₹60.
 *
 * WHERE THE ADDRESS REALLY IS decides, not what was typed. With the PIN's
 * place from India Post, the state is that place's state and a city zone
 * matches on its district(s) — a customer at 400001 who types "Kota" in the
 * City box is in Mumbai, and used to be charged Kota's rate. Without a place
 * (a PIN India Post does not list yet), the state comes from the PIN's digits
 * (`stateForPincode`) and the city from what was typed, as before.
 */
export function findDeliveryZone(
  zones: DeliveryZone[],
  address: ZoneAddress
): DeliveryZoneMatch | null {
  return rankDeliveryZones(zones, address)[0] ?? null;
}

/**
 * Every active zone that covers the address, the winner first — the order
 * `findDeliveryZone` picks from. The admin's PIN checker lists the rest as
 * "also covered by", so an owner can see why one zone beat another.
 *
 * A PIN that is not a complete six-digit code is no PIN at all. "32400" is a
 * customer halfway through typing, not an address — and every prefix rule
 * matched it, so the product page answered "Yes, we deliver" to five digits.
 */
export function rankDeliveryZones(
  zones: DeliveryZone[],
  address: ZoneAddress
): DeliveryZoneMatch[] {
  const typed = normalizePincode(address.pincode ?? "");
  const pincode = isFullPincode(typed) ? typed : "";
  const city = address.city?.trim() ?? "";
  // Nothing to go on is not "everywhere": no zone answers an empty address.
  if (!pincode && !city) return [];
  const place = pincode ? (address.place ?? null) : null;
  const state =
    (place ? matchStateName(place.state) : null) ??
    (pincode ? stateForPincode(pincode) : null) ??
    matchStateName(address.state ?? "");
  // The names a city zone may match: the real district(s), or the typed city
  // when the PIN's place is not known.
  const cities = place ? place.districts : city ? [city] : [];

  const hits: ZoneHit[] = [];
  for (const zone of zones) {
    if (!zone.isActive) continue;
    if (zoneExcludesPincode(zone, pincode)) continue;
    const hit = zone.coverage
      ? coverageHit(zone, { pincode, cities, state })
      : legacyHit(zone, { pincode, cities });
    if (hit) hits.push(hit);
  }

  hits.sort(
    (a, b) =>
      b.rank - a.rank ||
      // City agreement only ever separates PIN rules of EQUAL precision. It
      // was the top key once, and the city is a free-text field the CUSTOMER
      // fills in — so typing the name of a cheaper zone's city could make a
      // one-digit prefix outrank the exact six-digit zone built for that
      // address. The PIN is the part of the address the shop can rely on.
      b.cityAgrees - a.cityAgrees ||
      b.zone.priority - a.zone.priority ||
      a.zone.deliveryCharge - b.zone.deliveryCharge ||
      // Last resort: the id. A complete tie otherwise fell to array order,
      // and the browser's list and Mongo's are ordered differently — so the
      // zone NAME the customer was shown could belong to a different zone
      // from the one whose fee they were charged.
      a.zone.id.localeCompare(b.zone.id),
  );

  return hits.map((hit) => ({ zone: hit.zone, matchType: hit.matchType }));
}

/** A zone written with a `coverage`. */
function coverageHit(
  zone: DeliveryZone,
  address: { pincode: string; cities: string[]; state: string | null },
): ZoneHit | null {
  switch (zone.coverage) {
    case "pincodes": {
      const length = address.pincode ? longestPincodeRule(zonePincodeRules(zone), address.pincode) : 0;
      return length ? { zone, rank: 100 + length, cityAgrees: 0, matchType: "pincode" } : null;
    }
    case "cities":
      return anyCityMatches(zoneCities(zone), address.cities)
        ? { zone, rank: 51, cityAgrees: 0, matchType: "city" }
        : null;
    case "states":
      return address.state &&
        (zone.states ?? []).some((name) => matchStateName(name) === address.state)
        ? { zone, rank: 30, cityAgrees: 0, matchType: "state" }
        : null;
    case "country":
      return { zone, rank: 10, cityAgrees: 0, matchType: "country" };
    default:
      return null;
  }
}

/**
 * A zone written before `coverage`: one PIN rule and one city, ranked exactly
 * as they always were.
 *
 * The PIN rule is the zone's match; the city is a fallback. A zone with NO
 * pincode is genuinely city-wide; one WITH a pincode was scoped to it, and is
 * still found through its city when nothing better matches — removing that
 * would silently stop delivering to addresses that are covered today — but a
 * truly city-scoped rule outranks it.
 */
function legacyHit(
  zone: DeliveryZone,
  address: { pincode: string; cities: string[] },
): ZoneHit | null {
  const rule = normalizePincode(zone.pincode);
  if (rule && address.pincode && matchesZonePincode(rule, address.pincode)) {
    // A zone whose CITY also matches outranks one that only caught the pincode.
    //
    // Not a filter, a preference: a prefix zone spanning several cities is a
    // legitimate thing to configure, so it must still match when nothing better
    // does. But a loose prefix — "4" typed where "400" was meant — used to annex
    // every neighbouring city outright, beating the zone the admin had actually
    // built for that city.
    const cityAgrees = anyCityMatches([zone.city], address.cities) ? 1 : 0;
    return { zone, rank: 100 + rule.length, cityAgrees, matchType: "pincode" };
  }
  if (anyCityMatches([zone.city], address.cities)) {
    return { zone, rank: rule ? 50 : 51, cityAgrees: 0, matchType: "city" };
  }
  return null;
}

function anyCityMatches(zoneNames: string[], addressNames: string[]): boolean {
  return zoneNames.some(
    (name) => name.trim() !== "" && addressNames.some((city) => matchesZoneCity(name, city)),
  );
}


export function filterDeliveryZones(
  zones: DeliveryZone[],
  filters: DeliveryZoneListFilters
): DeliveryZone[] {
  const query = filters.search.trim().toLowerCase();

  return zones.filter((zone) => {
    if (filters.status === "active" && !zone.isActive) return false;
    if (filters.status === "inactive" && zone.isActive) return false;
    if (filters.kind !== "all" && zoneKind(zone) !== filters.kind) return false;

    if (!query) return true;

    // Every place the zone names. It searched `city` and `pincode` alone,
    // which a zone with a coverage leaves blank — "3240" found nothing.
    const haystack = [
      zone.name,
      ...zoneCities(zone),
      ...zonePincodeRules(zone),
      ...(zone.states ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function countActiveDeliveryZoneFilters(filters: DeliveryZoneListFilters): number {
  let count = 0;
  if (filters.kind !== "all") count += 1;
  return count;
}

/** What a zone is drawn as — see `DeliveryZoneKindFilter`. */
export function zoneKind(zone: DeliveryZone): Exclude<DeliveryZoneKindFilter, "all"> {
  if (zone.coverage === "radius" || zone.coverage === "polygon" || zone.coverage === "areas") return "map";
  if (zone.coverage === "cities") return "districts";
  if (zone.coverage === "states") return "states";
  return "needs-area";
}

/**
 * The cities zones name, one each. It read `zone.city`, which is "" on a PIN
 * or state zone and "Kota, Bundi" on a cities zone — so a shop with one PIN
 * zone showed "Cities: 1" and a filter option with no name.
 */
export function getUniqueZoneCities(zones: DeliveryZone[]): string[] {
  const byKey = new Map<string, string>();
  for (const city of zones.flatMap(zoneCities)) {
    if (!byKey.has(city.toLowerCase())) byKey.set(city.toLowerCase(), city);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export function formatZoneDeliveryTime(zone: DeliveryZone): string {
  const min = zone.minDeliveryDays;
  const max = zone.estimatedDeliveryDays;

  if (min === max) {
    // "Same day / next day" covered BOTH 0 and 1, so a zone that delivers today
    // and one that needs a day read identically.
    if (min === 0) return "Same day";
    if (min === 1) return "Next day";
    return `${min} days`;
  }

  // A range only reads as a range in the right order. `min > max` is possible on
  // data written before the form refused it, and rendered as "5–2 days".
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  // `${hi} days` said "1 days" on the shipped demo zone (0–1), which is the
  // first range most shops ever see.
  const hiLabel = hi === 1 ? "1 day" : `${hi} days`;
  return lo === 0 ? `Same day – ${hiLabel}` : `${lo}–${hiLabel}`;
}

/** A PIN rule as an owner reads it: "324001" exact, "3240…" for a prefix. */
export function describePincodeRule(rule: string): string {
  const digits = normalizePincode(rule);
  return digits.length === 6 ? digits : `${digits}…`;
}

function listed(items: string[], max: number): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
}

/**
 * What a zone covers, in words — for the zone list, its CSV and the form.
 *
 * `covers` names the area; `except` is the "leave out" list, or "" when there
 * is none.
 */
export function describeZoneCoverage(zone: DeliveryZone): { covers: string; except: string } {
  const excluded = (zone.excludedPincodes ?? []).map(normalizePincode).filter(Boolean);
  const except = excluded.length ? listed(excluded.map(describePincodeRule), 4) : "";

  switch (zone.coverage) {
    case "radius":
      return {
        covers: zone.center
          ? `${zone.radiusKm} km around ${zone.center.lat.toFixed(4)}, ${zone.center.lng.toFixed(4)}`
          : "Circle — no centre yet",
        except: "",
      };
    case "polygon": {
      const corners = zone.polygon?.length ?? 0;
      return { covers: corners >= 3 ? `Drawn area · ${corners} corners` : "Drawn area — not finished", except: "" };
    }
    case "areas": {
      const shapes = zone.areas ?? [];
      if (shapes.length === 1) return describeZoneCoverage({ ...zone, ...(shapes[0].kind === "radius" ? { coverage: "radius", center: shapes[0].center, radiusKm: shapes[0].radiusKm } : { coverage: "polygon", polygon: shapes[0].polygon }) });
      const circles = shapes.filter((shape) => shape.kind === "radius").length;
      const boundaries = shapes.length - circles;
      const parts = [circles ? `${circles} circle${circles === 1 ? "" : "s"}` : "", boundaries ? `${boundaries} boundar${boundaries === 1 ? "y" : "ies"}` : ""].filter(Boolean);
      return { covers: shapes.length ? `${shapes.length} map areas · ${parts.join(", ")}` : "Map areas — none yet", except: "" };
    }
    case "country":
      return { covers: "All of India", except };
    case "states":
      return { covers: `States: ${listed(zone.states ?? [], 3) || "none chosen"}`, except };
    case "cities":
      return { covers: `Districts: ${listed(zoneCities(zone), 3) || "none chosen"}`, except };
    case "pincodes":
      return {
        covers: `PIN codes: ${listed(zonePincodeRules(zone).map(describePincodeRule), 4) || "none chosen"}`,
        except,
      };
    default: {
      // A zone from before coverage: its one PIN rule, its city behind it.
      const rule = normalizePincode(zone.pincode);
      const city = zone.city.trim();
      if (rule) return { covers: `PIN ${describePincodeRule(rule)}${city ? ` · ${city}` : ""}`, except };
      return { covers: city ? `City: ${city}` : "Nothing yet", except };
    }
  }
}
