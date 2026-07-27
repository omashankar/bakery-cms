import type { DeliveryZone, DeliveryZoneFormData } from "@/types/delivery";
import {
  filterDeliveryZones,
  findDeliveryZone,
  getUniqueZoneCities,
} from "./delivery-zone-utils";
import { replaceZonesRequest } from "./commerce-api";

const STORAGE_KEY = "bakery-cms-delivery-zones";

export const DELIVERY_ZONES_UPDATED_EVENT = "bakery-delivery-zones-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DELIVERY_ZONES_UPDATED_EVENT));
}

/** Local-only write (localStorage + event). No server dual-write. */
function lowPersist(zones: DeliveryZone[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  emitUpdated();
}

/** Mutation write: local + best-effort server replace-all. */
function persist(zones: DeliveryZone[]): void {
  lowPersist(zones);
  replaceZonesRequest(zones);
}

/** Hydration: write the server's zones into the local cache (no re-push). */
export function persistServerZones(zones: DeliveryZone[]): void {
  lowPersist(zones);
}

export function seedZones(): DeliveryZone[] {
  const timestamp = nowIso();
  return [
    {
      id: "zone-mumbai-central",
      name: "Mumbai Central",
      city: "Mumbai",
      pincode: "400001",
      radiusKm: 8,
      deliveryCharge: 99,
      minDeliveryDays: 0,
      estimatedDeliveryDays: 1,
      isActive: true,
      priority: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "zone-mumbai-suburbs",
      name: "Mumbai Suburbs",
      city: "Mumbai",
      pincode: "4000",
      radiusKm: 15,
      deliveryCharge: 79,
      minDeliveryDays: 1,
      estimatedDeliveryDays: 1,
      isActive: true,
      priority: 80,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "zone-pune",
      name: "Pune City",
      city: "Pune",
      pincode: "411",
      radiusKm: 12,
      deliveryCharge: 129,
      minDeliveryDays: 1,
      estimatedDeliveryDays: 2,
      isActive: true,
      priority: 90,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "zone-thane",
      name: "Thane",
      city: "Thane",
      pincode: "400601",
      radiusKm: 10,
      deliveryCharge: 89,
      minDeliveryDays: 1,
      estimatedDeliveryDays: 2,
      isActive: true,
      priority: 70,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "zone-navi-mumbai",
      name: "Navi Mumbai",
      city: "Navi Mumbai",
      pincode: "410",
      radiusKm: 14,
      deliveryCharge: 109,
      minDeliveryDays: 1,
      estimatedDeliveryDays: 2,
      isActive: false,
      priority: 60,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

export function loadDeliveryZones(): DeliveryZone[] {
  if (typeof window === "undefined") return seedZones();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedZones();
      lowPersist(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as DeliveryZone[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedZones();
  } catch {
    const seeded = seedZones();
    // Local-only: re-seeding on corrupt storage must NOT push defaults back to
    // the server and clobber the admin's real zones.
    lowPersist(seeded);
    return seeded;
  }
}

export function getDeliveryZoneById(id: string): DeliveryZone | null {
  return loadDeliveryZones().find((zone) => zone.id === id) ?? null;
}

export function createDeliveryZone(data: DeliveryZoneFormData): DeliveryZone {
  const zones = loadDeliveryZones();
  const timestamp = nowIso();
  const zone: DeliveryZone = {
    ...data,
    id: `zone-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persist([zone, ...zones]);
  return zone;
}

export function updateDeliveryZone(
  id: string,
  data: DeliveryZoneFormData
): DeliveryZone | null {
  const zones = loadDeliveryZones();
  const index = zones.findIndex((zone) => zone.id === id);
  if (index === -1) return null;

  const updated: DeliveryZone = {
    ...zones[index],
    ...data,
    id,
    updatedAt: nowIso(),
  };
  zones[index] = updated;
  persist(zones);
  return updated;
}

export function deleteDeliveryZones(ids: string[]): number {
  const zones = loadDeliveryZones();
  const next = zones.filter((zone) => !ids.includes(zone.id));
  const count = zones.length - next.length;
  if (count === 0) return 0;
  persist(next);
  return count;
}

export function toggleDeliveryZoneActive(id: string): DeliveryZone | null {
  const zone = getDeliveryZoneById(id);
  if (!zone) return null;
  return updateDeliveryZone(id, { ...zone, isActive: !zone.isActive });
}

export function resetDeliveryZones(): DeliveryZone[] {
  const seeded = seedZones();
  persist(seeded);
  return seeded;
}

export function getActiveDeliveryZones(): DeliveryZone[] {
  return loadDeliveryZones().filter((zone) => zone.isActive);
}

export function resolveDeliveryZoneForAddress(address: {
  city?: string;
  pincode?: string;
}): ReturnType<typeof findDeliveryZone> {
  return findDeliveryZone(loadDeliveryZones(), address);
}

export { filterDeliveryZones, getUniqueZoneCities, findDeliveryZone };

export function getDeliveryZoneStats(zones: DeliveryZone[] = loadDeliveryZones()) {
  return {
    total: zones.length,
    active: zones.filter((zone) => zone.isActive).length,
    inactive: zones.filter((zone) => !zone.isActive).length,
    cities: getUniqueZoneCities(zones).length,
  };
}

export function createEmptyDeliveryZone(): DeliveryZoneFormData {
  return {
    name: "",
    city: "",
    pincode: "",
    radiusKm: 10,
    deliveryCharge: 99,
    minDeliveryDays: 1,
    estimatedDeliveryDays: 2,
    isActive: true,
    priority: 50,
  };
}
