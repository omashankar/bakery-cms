import type { DeliveryZone, DeliveryZoneFormData } from "@/types/delivery";
import {
  filterDeliveryZones,
  findDeliveryZone,
  getUniqueZoneCities,
} from "./delivery-zone-utils";
import { replaceZonesRequest, zonesHydration } from "./commerce-api";
import type { WriteResult } from "@/lib/write-result";

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

/**
 * Mutation write: optimistic locally, rolled back if the server refuses.
 *
 * The local write used to stand whatever the server said. That is not merely a
 * stale cache — every save sends the WHOLE list, so one row the server rejects
 * stays in the list and makes every subsequent save fail too. A single invalid
 * value (a decimal in a days field, say) permanently bricked zone editing in
 * that browser, with no message explaining it and no way out but clearing site
 * data.
 *
 * Reverting keeps the local cache to things the server has actually accepted, so
 * a refusal costs one save instead of all of them.
 */
async function persist(zones: DeliveryZone[]): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  // The ids this browser BELIEVED existed, before its own edit.
  //
  // A replace-all otherwise means "these are all the zones there are", so a save
  // from a tab opened an hour ago deleted every zone created on another device
  // since. Sending what it knew lets the server delete only what this admin
  // actually removed, and leave anything it has never seen alone.
  const knownIds = readIds(previous);

  lowPersist(zones);
  const accepted = await replaceZonesRequest(zones, knownIds);

  // Roll back ONLY if this write is still the one in the cache.
  //
  // Restoring the entry snapshot unconditionally would undo a concurrent save
  // that the server had accepted in the meantime — a rejected write silently
  // destroying a good one, which is worse than the poisoned cache the rollback
  // exists to prevent.
  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(zones);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      emitUpdated();
    }
  }

  return accepted;
}

/** Zone ids out of a raw localStorage snapshot, for the conflict check. */
function readIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DeliveryZone[];
    return Array.isArray(parsed) ? parsed.map((zone) => zone.id).filter(Boolean) : [];
  } catch {
    return [];
  }
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
  // No zones on the server, and deliberately no seed.
  //
  // This used to return `seedZones()` here, which made it a landmine: any
  // server-side caller that forgot to supply the real zones got Mumbai/Pune
  // sample data instead, silently, and priced live deliveries from it. That is
  // exactly what happened — `calculateCartTotals` declared a `zonesOverride`
  // and never forwarded it, so the authoritative checkout price came from the
  // demo rows for as long as the feature existed.
  //
  // Empty is the honest answer: this is a localStorage repository and there is
  // no localStorage here. A server caller that needs zones reads Mongo and
  // passes them in; one that forgets now gets no match and the shop's own
  // fallback fee, not a fictional one, and says so in the log.
  if (typeof window === "undefined") {
    console.error(
      "[zones] loadDeliveryZones() called on the server. Read zones from Mongo and pass them explicitly — returning none.",
    );
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedZones();
      lowPersist(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as DeliveryZone[];
    // A stored EMPTY list is an answer, not an absence.
    //
    // This read `parsed.length > 0 ? parsed : seedZones()`, so an admin who
    // deleted every zone saw the five demo zones reappear in the table on the
    // next render — and the next save PUT them straight back to the server.
    // "No zones" is a legitimate configuration; only a missing key means
    // "never set up", and that case is handled above.
    return Array.isArray(parsed) ? parsed : seedZones();
  } catch {
    const seeded = seedZones();
    // Local-only: re-seeding on corrupt storage must NOT push defaults back to
    // the server and clobber the admin's real zones.
    lowPersist(seeded);
    return seeded;
  }
}

/**
 * Read the list AFTER hydration, then write it.
 *
 * The gate guarded the PUT but not the READ that composed it: every mutation
 * called `loadDeliveryZones()` first, so an admin who clicked before the
 * server's copy arrived built their payload from the demo seed. The gate then
 * opened and dutifully shipped it — the seed-clobber this gate exists to prevent,
 * surviving inside it.
 *
 * The mutator runs on a list the server has already confirmed.
 */
async function mutateZones<T>(
  /** Returned when hydration never lands, so callers never see `undefined`. */
  fallback: T,
  mutate: (current: DeliveryZone[]) => { next: DeliveryZone[]; value: T } | { value: T; next?: undefined },
): Promise<WriteResult<T>> {
  if (!(await zonesHydration.waitForSettled())) {
    // `undefined as T` was a lie the type system accepted and the UI printed:
    // the zones page renders `Deleted ${count} zones`, so a closed gate produced
    // "Deleted undefined zones".
    return { value: fallback, persisted: false };
  }

  const outcome = mutate(loadDeliveryZones());

  // "Nothing to write" is only success when nothing was ASKED for.
  //
  // The mutators return no `next` in two different situations: a delete that
  // matched nothing (fine — nothing was requested), and an edit whose target id
  // is not in the list because another device removed it. Reporting `true` for
  // the second gave the admin a green "Delivery zone updated" for an edit that
  // reached nothing, on a zone that no longer exists.
  if (outcome.next === undefined) {
    return { value: outcome.value, persisted: outcome.value !== null };
  }
  return { value: outcome.value, persisted: await persist(outcome.next) };
}

export async function createDeliveryZone(
  data: DeliveryZoneFormData
): Promise<WriteResult<DeliveryZone>> {
  const timestamp = nowIso();
  const zone: DeliveryZone = {
    ...data,
    // Random, not `Date.now()`. Two zones created in the same millisecond shared
    // an id, and the server's replace-all upserts by id — so one silently
    // overwrote the other while the admin's table went on showing both.
    id: `zone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const result = await mutateZones(zone, (current) => ({ next: [zone, ...current], value: zone }));
  return { value: zone, persisted: result.persisted };
}

export async function updateDeliveryZone(
  id: string,
  data: DeliveryZoneFormData
): Promise<WriteResult<DeliveryZone | null>> {
  return mutateZones<DeliveryZone | null>(null, (current) => {
    const index = current.findIndex((zone) => zone.id === id);
    if (index === -1) return { value: null };

    const updated: DeliveryZone = { ...current[index], ...data, id, updatedAt: nowIso() };
    const next = [...current];
    next[index] = updated;
    return { next, value: updated };
  });
}

export async function deleteDeliveryZones(ids: string[]): Promise<WriteResult<number>> {
  return mutateZones<number>(0, (current) => {
    const next = current.filter((zone) => !ids.includes(zone.id));
    const count = current.length - next.length;
    // Nothing removed means nothing was sent, so nothing could fail to persist.
    if (count === 0) return { value: 0 };
    return { next, value: count };
  });
}

export async function toggleDeliveryZoneActive(
  id: string
): Promise<WriteResult<DeliveryZone | null>> {
  return mutateZones<DeliveryZone | null>(null, (current) => {
    const index = current.findIndex((zone) => zone.id === id);
    if (index === -1) return { value: null };

    const updated: DeliveryZone = {
      ...current[index],
      isActive: !current[index].isActive,
      updatedAt: nowIso(),
    };
    const next = [...current];
    next[index] = updated;
    return { next, value: updated };
  });
}

export async function resetDeliveryZones(): Promise<WriteResult<DeliveryZone[]>> {
  const seeded = seedZones();
  const result = await mutateZones(seeded, () => ({ next: seeded, value: seeded }));
  return { value: seeded, persisted: result.persisted };
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
