import "server-only";

import type { LatLng } from "@/types/delivery";

/**
 * WHAT OPENSTREETMAP SAYS IS AT A MAP PIN — its postal code, town and state.
 *
 * Free, with no key and no billing (owner, 2026-10-27: "pura map system free
 * wala"). Asked by the SERVER, so a customer cannot make the answer up, from
 * Nominatim — OpenStreetMap's own geocoder — whose public service asks three
 * things of every caller, all done here:
 *
 * - a User-Agent naming the application (and an email, `MAP_CONTACT_EMAIL`);
 * - no more than one request a second — calls are queued a second apart;
 * - answers cached rather than asked again — the same door is asked once.
 *
 * A busy shop should run its own Nominatim, or use a hosted one, and point
 * `MAP_GEOCODER_URL` at it; nothing else changes.
 *
 * India's postal codes are patchy in OpenStreetMap, so "no postal code" is a
 * normal answer here, not a failure — see `verifyDeliveryPin` for what the
 * shop does with it.
 */

export interface GeocodedPlace {
  /** Six digits, or null when OpenStreetMap has none for this point. */
  postalCode: string | null;
  /** The town: city, else town, else village. */
  city: string | null;
  /** The neighbourhood: suburb, neighbourhood or village — "Borkhera". */
  locality: string | null;
  /** The district-level area. */
  district: string | null;
  state: string | null;
  formattedAddress: string;
}

export type LocationServiceFailure = "timeout" | "busy" | "error";

export class LocationServiceUnavailableError extends Error {
  constructor(readonly reason: LocationServiceFailure, detail?: string) {
    super(`Location lookup unavailable: ${reason}${detail ? ` (${detail})` : ""}`);
    this.name = "LocationServiceUnavailableError";
  }
}

const DEFAULT_GEOCODER = "https://nominatim.openstreetmap.org";
const TIMEOUT_MS = 6_000;
/** The public service's limit is one a second; a little more, to be safe. */
const SPACING_MS = 1_100;
/** A queue longer than this is a busy shop, not a slow network — say so instead of waiting. */
const MAX_QUEUE_WAIT_MS = 8_000;
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_MAX = 2_000;

const cache = new Map<string, { place: GeocodedPlace; at: number }>();
let nextSlot = 0;

/** ~1 m: two pins closer than this are the same door. */
const cacheKey = (point: LatLng) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;

/** For tests. */
export function clearGeocodeCache(): void {
  cache.clear();
  searchCache.clear();
  nextSlot = 0;
}

/** Who is asking, as the usage policy requires. */
export function geocoderUserAgent(): string {
  return "BakeryCMS/1.0 (delivery address check)";
}

interface NominatimAddress {
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  hamlet?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country_code?: string;
}

/** Nominatim's answer, read. Exported so a test can hand it a recorded response. */
export function readNominatimResponse(body: {
  error?: string;
  display_name?: string;
  address?: NominatimAddress;
}): GeocodedPlace {
  // "Unable to geocode" is the sea, a desert or nowhere mapped: no place, not a failure.
  const address = body.error ? {} : (body.address ?? {});
  const postal = (address.postcode ?? "").replace(/\s/g, "");
  return {
    postalCode: /^[1-9]\d{5}$/.test(postal) ? postal : null,
    city: address.city ?? address.town ?? address.village ?? address.suburb ?? null,
    locality: address.suburb ?? address.neighbourhood ?? address.quarter ?? address.village ?? address.hamlet ?? null,
    district: address.state_district ?? address.county ?? null,
    state: address.state ?? null,
    formattedAddress: body.display_name ?? "",
  };
}

/** Waits for this caller's turn, a second after the last one. */
async function takeTurn(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  if (slot - now > MAX_QUEUE_WAIT_MS) throw new LocationServiceUnavailableError("busy", "queue full");
  nextSlot = slot + SPACING_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

/** A place Nominatim found for a search — read by `osm-search.server.ts`. */
export interface NominatimHit {
  display_name?: string;
  lat?: string;
  lon?: string;
  /** "city", "suburb", "state", "residential", "railway"… */
  addresstype?: string;
  address?: NominatimAddress & { road?: string; house_number?: string; county?: string };
}

const searchCache = new Map<string, { hits: NominatimHit[]; at: number }>();

/**
 * Nominatim's SEARCH — for a customer who pressed Search, never per keystroke.
 *
 * Its usage policy forbids autocomplete, so the box's suggestions come from
 * Photon; this answers only an explicit "Search for …". It is here because
 * it knows what Photon does not: Hindi names (जयपुर, कनॉट प्लेस — measured
 * 2026-10-28, Photon found neither) and some places Photon misses. Shares
 * the one-a-second queue with the reverse lookup above.
 */
export async function searchNominatim(query: string): Promise<NominatimHit[]> {
  const id = query.toLowerCase();
  const hit = searchCache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.hits;

  await takeTurn();
  const base = (process.env.MAP_GEOCODER_URL?.trim() || DEFAULT_GEOCODER).replace(/\/+$/, "");
  const email = process.env.MAP_CONTACT_EMAIL?.trim();
  const url =
    `${base}/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=5&accept-language=en` +
    `&q=${encodeURIComponent(query)}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
  let hits: NominatimHit[];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": geocoderUserAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 429) throw new LocationServiceUnavailableError("busy", "HTTP 429");
    if (!res.ok) throw new LocationServiceUnavailableError("error", `HTTP ${res.status}`);
    hits = (await res.json()) as NominatimHit[];
  } catch (error) {
    if (error instanceof LocationServiceUnavailableError) throw error;
    const name = (error as { name?: string })?.name;
    throw new LocationServiceUnavailableError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "error");
  }
  if (searchCache.size >= CACHE_MAX) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(id, { hits: Array.isArray(hits) ? hits : [], at: Date.now() });
  return Array.isArray(hits) ? hits : [];
}

/** What is at this point, per OpenStreetMap. Throws `LocationServiceUnavailableError` when it cannot be asked. */
export async function reverseGeocode(point: LatLng): Promise<GeocodedPlace> {
  const id = cacheKey(point);
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.place;

  await takeTurn();
  const base = (process.env.MAP_GEOCODER_URL?.trim() || DEFAULT_GEOCODER).replace(/\/+$/, "");
  const email = process.env.MAP_CONTACT_EMAIL?.trim();
  const url =
    `${base}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en` +
    `&lat=${point.lat}&lon=${point.lng}${email ? `&email=${encodeURIComponent(email)}` : ""}`;

  let body: Parameters<typeof readNominatimResponse>[0];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": geocoderUserAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 429) throw new LocationServiceUnavailableError("busy", "HTTP 429");
    if (!res.ok) throw new LocationServiceUnavailableError("error", `HTTP ${res.status}`);
    body = (await res.json()) as typeof body;
  } catch (error) {
    if (error instanceof LocationServiceUnavailableError) throw error;
    const name = (error as { name?: string })?.name;
    throw new LocationServiceUnavailableError(
      name === "TimeoutError" || name === "AbortError" ? "timeout" : "error",
      error instanceof Error ? error.message : undefined,
    );
  }

  const place = readNominatimResponse(body);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(id, { place, at: Date.now() });
  return place;
}
