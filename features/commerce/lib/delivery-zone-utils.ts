import type { DeliveryZone, DeliveryZoneListFilters, DeliveryZoneMatch } from "@/types/delivery";

export function normalizePincode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function matchesZonePincode(zonePincode: string, addressPincode: string): boolean {
  const zone = normalizePincode(zonePincode);
  const address = normalizePincode(addressPincode);
  if (!zone || !address) return false;
  if (zone.length === 6) return zone === address;
  return address.startsWith(zone);
}

export function matchesZoneCity(zoneCity: string, addressCity: string): boolean {
  return zoneCity.trim().toLowerCase() === addressCity.trim().toLowerCase();
}

/**
 * Find the best active delivery zone for an address.
 *
 * Order of preference, most specific first:
 *   1. the longest pincode rule that matches — an exact 6-digit zone beats a
 *      4-digit prefix, which beats a 2-digit one
 *   2. then whether the zone's city agrees, to settle two rules of equal precision
 *   3. then the admin's explicit priority
 *   4. then the cheaper charge, so a tie never costs the customer more
 *   5. then the id, so the answer is the same on both sides of the wire
 *
 * Specificity has to come first. Sorting by priority alone meant that two zones
 * left on the default priority — which is what the form creates — were separated
 * only by price, so a broad "56" prefix zone at ₹40 silently outbid the exact
 * "560034" zone the admin had just created for that address at ₹60. The narrower
 * rule is the one the admin wrote deliberately.
 */
export function findDeliveryZone(
  zones: DeliveryZone[],
  address: { city?: string; pincode?: string }
): DeliveryZoneMatch | null {
  const activeZones = zones.filter((zone) => zone.isActive);

  const pincode = normalizePincode(address.pincode ?? "");
  const city = address.city?.trim() ?? "";

  if (pincode) {
    // A zone whose CITY also matches outranks one that only caught the pincode.
    //
    // Not a filter, a preference: a prefix zone spanning several cities is a
    // legitimate thing to configure, so it must still match when nothing better
    // does. But a loose prefix — "4" typed where "400" was meant — used to annex
    // every neighbouring city outright, beating the zone the admin had actually
    // built for that city.
    const cityAgrees = (zone: DeliveryZone) =>
      city && zone.city.trim() ? (matchesZoneCity(zone.city, city) ? 1 : 0) : 0;

    const pincodeMatches = activeZones
      .filter((zone) => matchesZonePincode(zone.pincode, pincode))
      .sort(
        (a, b) =>
          // SPECIFICITY FIRST. City agreement was the top key, and the city is a
          // free-text field the CUSTOMER fills in — so typing the name of a
          // cheaper zone's city could make a one-digit prefix outrank the exact
          // six-digit zone built for that address. The pincode is the part of the
          // address the shop can actually rely on; the city only breaks ties
          // between rules of equal precision.
          normalizePincode(b.pincode).length - normalizePincode(a.pincode).length ||
          cityAgrees(b) - cityAgrees(a) ||
          b.priority - a.priority ||
          a.deliveryCharge - b.deliveryCharge ||
          // Last resort: the id. A complete tie otherwise fell to array order,
          // and the browser's list and Mongo's are ordered differently — so the
          // zone NAME the customer was shown could belong to a different zone
          // from the one whose fee they were charged.
          a.id.localeCompare(b.id),
      );

    if (pincodeMatches[0]) {
      return { zone: pincodeMatches[0], matchType: "pincode" };
    }
  }

  if (city) {
    // A zone with NO pincode is genuinely city-wide; one WITH a pincode was
    // scoped to it, and only reaches this branch because that pincode did not
    // match. It can still serve as a last resort — removing it would silently
    // stop delivering to addresses that are covered today — but a truly
    // city-scoped rule is the better answer whenever one exists.
    const cityScoped = (zone: DeliveryZone) => (normalizePincode(zone.pincode) ? 0 : 1);

    const cityMatches = activeZones
      .filter((zone) => matchesZoneCity(zone.city, city))
      .sort(
        (a, b) =>
          cityScoped(b) - cityScoped(a) ||
          b.priority - a.priority ||
          a.deliveryCharge - b.deliveryCharge ||
          a.id.localeCompare(b.id),
      );

    if (cityMatches[0]) {
      return { zone: cityMatches[0], matchType: "city" };
    }
  }

  return null;
}

export function filterDeliveryZones(
  zones: DeliveryZone[],
  filters: DeliveryZoneListFilters
): DeliveryZone[] {
  const query = filters.search.trim().toLowerCase();

  return zones.filter((zone) => {
    if (filters.status === "active" && !zone.isActive) return false;
    if (filters.status === "inactive" && zone.isActive) return false;
    if (filters.city !== "all" && zone.city.toLowerCase() !== filters.city.toLowerCase()) {
      return false;
    }

    if (!query) return true;

    const haystack = `${zone.name} ${zone.city} ${zone.pincode}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function countActiveDeliveryZoneFilters(filters: DeliveryZoneListFilters): number {
  let count = 0;
  if (filters.city !== "all") count += 1;
  return count;
}

export function getUniqueZoneCities(zones: DeliveryZone[]): string[] {
  return [...new Set(zones.map((zone) => zone.city))].sort((a, b) => a.localeCompare(b));
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
