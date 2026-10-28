import "server-only";

import type { LatLng } from "@/types/delivery";
import { geocoderUserAgent } from "./osm-geocoding.server";
import { pincodeNear } from "./pincode-locator";

/**
 * ADDRESS SUGGESTIONS AS THE CUSTOMER TYPES — free, from OpenStreetMap.
 *
 * Photon (komoot's search over OpenStreetMap data) is built for search-as-you-
 * type, which the Nominatim service forbids; it needs no key. Asked through
 * the shop's own server so the answers can be cached and the calls limited,
 * and so `MAP_SEARCH_URL` can point at a self-hosted Photon for a busy shop.
 *
 * A suggestion is only a way to put the pin near the door — never proof of
 * an address. The pin is checked on its own when the order is priced.
 */

export interface AddressSuggestion {
  label: string;
  /** The parts, for filling boxes the customer left empty. */
  postalCode?: string;
  /** The neighbourhood — "Borkhera" — for naming the place on the header. */
  area?: string;
  city?: string;
  state?: string;
  location: LatLng;
}

const DEFAULT_SEARCH = "https://photon.komoot.io";
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60_000;
const CACHE_MAX = 1_000;
/** India, as a box: west, south, east, north. */
const INDIA_BBOX = "68.1,6.5,97.5,37.1";

const cache = new Map<string, { results: AddressSuggestion[]; at: number }>();

export function clearSearchCache(): void {
  cache.clear();
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
  };
}

/** Photon's answer, read. Exported for a test. */
export function readPhotonResponse(body: { features?: PhotonFeature[] }): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const feature of body.features ?? []) {
    const p = feature.properties ?? {};
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (p.countrycode && p.countrycode.toUpperCase() !== "IN") continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const label = [p.name, street !== p.name ? street : "", p.locality ?? p.district, p.city ?? p.county, p.state, p.postcode]
      .filter((part, i, all) => part && all.indexOf(part) === i)
      .join(", ");
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const postal = (p.postcode ?? "").replace(/\s/g, "");
    out.push({
      label,
      postalCode: /^[1-9]\d{5}$/.test(postal) ? postal : undefined,
      area: p.locality ?? p.district,
      city: p.city ?? p.county,
      state: p.state,
      location: { lat, lng },
    });
  }
  return out;
}

/**
 * Each suggestion's PIN from where India Post's offices stand, not from the
 * map: Photon offered "PHC, Borkhera … 324001" while the pin there was told
 * 324002, and "Don't Know Pincode?" filled the box with the map's wrong one.
 * Where no office is near, the suggestion carries no PIN at all.
 */
async function withIndiaPostPins(results: AddressSuggestion[]): Promise<AddressSuggestion[]> {
  return Promise.all(
    results.map(async (place) => {
      const pincode = (await pincodeNear(place.location).catch(() => null))?.pincode;
      const words = place.label.replace(/,?\s*\b[1-9]\d{5}\b/g, "").trim();
      return { ...place, postalCode: pincode, label: pincode ? `${words} ${pincode}` : words };
    }),
  );
}

/** Suggestions for what has been typed, nudged towards `near`. Empty on any failure — search is a help, not a gate. */
export async function searchAddresses(query: string, near?: LatLng | null): Promise<AddressSuggestion[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 3) return [];
  const id = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  const base = (process.env.MAP_SEARCH_URL?.trim() || DEFAULT_SEARCH).replace(/\/+$/, "");
  const url =
    `${base}/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=${INDIA_BBOX}` +
    (near ? `&lat=${near.lat}&lon=${near.lng}` : "");
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": geocoderUserAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const results = await withIndiaPostPins(readPhotonResponse((await res.json()) as { features?: PhotonFeature[] }));
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(id, { results, at: Date.now() });
    return results;
  } catch {
    return [];
  }
}
