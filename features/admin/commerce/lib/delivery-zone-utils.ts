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

/** Find the best active delivery zone for an address (pincode preferred over city). */
export function findDeliveryZone(
  zones: DeliveryZone[],
  address: { city?: string; pincode?: string }
): DeliveryZoneMatch | null {
  const activeZones = zones
    .filter((zone) => zone.isActive)
    .sort((a, b) => b.priority - a.priority || a.deliveryCharge - b.deliveryCharge);

  const pincode = normalizePincode(address.pincode ?? "");
  const city = address.city?.trim() ?? "";

  if (pincode) {
    const pincodeMatch = activeZones.find((zone) => matchesZonePincode(zone.pincode, pincode));
    if (pincodeMatch) {
      return { zone: pincodeMatch, matchType: "pincode" };
    }
  }

  if (city) {
    const cityMatch = activeZones.find((zone) => matchesZoneCity(zone.city, city));
    if (cityMatch) {
      return { zone: cityMatch, matchType: "city" };
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
  if (zone.minDeliveryDays === zone.estimatedDeliveryDays) {
    return zone.minDeliveryDays <= 1 ? "Same day / next day" : `${zone.minDeliveryDays} days`;
  }
  return `${zone.minDeliveryDays}–${zone.estimatedDeliveryDays} days`;
}
