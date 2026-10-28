import "server-only";

import type { LatLng } from "@/types/delivery";
import { geocoderUserAgent, LocationServiceUnavailableError, searchNominatim, type NominatimHit } from "./osm-geocoding.server";
import { pincodeNear, pincodePoints } from "./pincode-locator";
import { listDistricts, lookUpPincode, placesInDistrict } from "./pincode-directory";

/**
 * ADDRESS SUGGESTIONS AS THE CUSTOMER TYPES — anywhere in India, free.
 *
 * Three sources, each for what it does best (measured on 36 places across
 * India, 2026-10-28):
 *
 * - India Post's own directory, first, for a PIN code ("324005") or a
 *   district ("Kota district"). Photon labelled a PIN as ", Ladpura Tehsil"
 *   and put 799001 at 799008; "Kota district" found a fort in Andhra Pradesh.
 *   The shop's own data answers both, with no service asked.
 * - Photon (komoot's search over OpenStreetMap), as the customer types: built
 *   for search-as-you-type, which Nominatim forbids. It found localities,
 *   towns and villages in every state and union territory tried.
 * - Nominatim, only when the customer presses Search (`full`): its policy
 *   forbids autocomplete. It knows Hindi names Photon does not (जयपुर,
 *   कनॉट प्लेस) and some places Photon misses ("Kota Junction").
 *
 * Asked through the shop's own server so answers are cached and calls
 * limited, and so `MAP_SEARCH_URL` / `MAP_GEOCODER_URL` can point at
 * self-hosted servers for a busy shop.
 *
 * A suggestion only moves the map — never proof of an address. The pin is
 * checked on its own when the order is priced.
 */

export interface AddressSuggestion {
  label: string;
  /** India Post's PIN for the spot. Absent for a whole town, district or state — those are many PINs. */
  postalCode?: string;
  /** The neighbourhood — "Borkhera" — for naming the place on the header. */
  area?: string;
  city?: string;
  state?: string;
  location: LatLng;
  /** How close to show it: a street at 17, a town at 12, a state at 7. */
  zoom?: number;
}

/** No search could be made — every source that should have answered failed. */
export class AddressSearchUnavailableError extends Error {
  constructor() {
    super("Address search is unavailable");
    this.name = "AddressSearchUnavailableError";
  }
}

const DEFAULT_SEARCH = "https://photon.komoot.io";
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60_000;
const CACHE_MAX = 1_000;
/** India, as a box: west, south, east, north. */
const INDIA_BBOX = "68.1,6.5,97.5,37.1";
const MAX_RESULTS = 6;

const cache = new Map<string, { results: AddressSuggestion[]; at: number }>();

export function clearSearchCache(): void {
  cache.clear();
}

/** How close to show a place, by what kind of place it is. */
function zoomFor(kind: string | undefined): number {
  switch (kind) {
    case "country":
      return 5;
    case "state":
      return 7;
    case "county":
    case "state_district":
      return 10;
    case "city":
    case "municipality":
      return 12;
    // A town is often one PIN (Sangod, 325601): named with it, but not a door.
    case "town":
      return 14;
    case "district":
    case "suburb":
    case "locality":
    case "village":
    case "hamlet":
    case "neighbourhood":
    case "quarter":
      return 15;
    default:
      return 17;
  }
}

/** A whole town, district or state is many PINs: none is put on it. */
const WIDE = new Set(["country", "state", "county", "state_district", "city", "municipality"]);

/** Shown at least this close, a place is small enough for one PIN. */
const PIN_ZOOM = 14;

/** "a, , b, a" → "a, b": the parts once each, none empty. */
function joinParts(parts: (string | undefined)[]): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(", ");
}

/** A label with any six-digit code taken out — and no comma left hanging where it was. */
function withoutPin(label: string): string {
  return label
    .split(",")
    .map((part) => part.replace(/\b[1-9]\d{5}\b/g, "").trim())
    .filter(Boolean)
    .join(", ");
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
    /** "house", "street", "locality", "district", "city", "county", "state"… */
    type?: string;
    /** OpenStreetMap's own tag: a village Photon types as "city" is place=village. */
    osm_key?: string;
    osm_value?: string;
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
    // A postcode feature is named by its code: the code is not a place's name.
    const name = /^\d{6}$/.test(p.name ?? "") ? "" : p.name;
    const label = joinParts([name, street !== name ? street : "", p.locality ?? p.district, p.city ?? p.county, p.state, p.postcode]);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const postal = (p.postcode ?? "").replace(/\s/g, "");
    const kind = p.osm_key === "place" && p.osm_value ? p.osm_value : p.type;
    out.push({
      label,
      postalCode: /^[1-9]\d{5}$/.test(postal) && !WIDE.has(kind ?? "") ? postal : undefined,
      area: p.locality ?? p.district,
      city: p.city ?? p.county,
      state: p.state,
      location: { lat, lng },
      zoom: zoomFor(kind),
    });
  }
  return out;
}

/** Nominatim's search hits, read. Exported for a test. */
export function readNominatimSearch(hits: NominatimHit[]): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  for (const hit of hits) {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const a = hit.address ?? {};
    // "Jaipur, Jaipur Tehsil, Jaipur, Rajasthan, 302001, India" → each name once, no PIN, no country.
    const label = withoutPin(
      joinParts(
        (hit.display_name ?? "")
          .split(",")
          .filter((part) => part.trim().toLowerCase() !== "india"),
      ),
    );
    if (!label) continue;
    out.push({
      label,
      area: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village,
      city: a.city ?? a.town ?? a.village ?? a.county,
      state: a.state,
      location: { lat, lng },
      zoom: zoomFor(hit.addresstype),
    });
  }
  return out;
}

/**
 * Each street-level suggestion's PIN from where India Post's offices stand,
 * not from the map: Photon offered "PHC, Borkhera … 324001" while the pin
 * there was told 324002. A whole town, district or state gets none — it is
 * many PINs, and naming one would be inventing it.
 */
async function withIndiaPostPins(results: AddressSuggestion[]): Promise<AddressSuggestion[]> {
  return Promise.all(
    results.map(async (place) => {
      const words = withoutPin(place.label);
      if ((place.zoom ?? 17) < PIN_ZOOM) return { ...place, postalCode: undefined, label: words };
      const pincode = (await pincodeNear(place.location).catch(() => null))?.pincode;
      return { ...place, postalCode: pincode, label: pincode ? `${words} ${pincode}` : words };
    }),
  );
}

/** The middle of some points: the one nearest their median, so it is a real office, never a field between two. */
function middleOf(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
  const lat = sorted(points.map((p) => p.lat))[points.length >> 1];
  const lng = sorted(points.map((p) => p.lng))[points.length >> 1];
  return points.reduce((best, p) =>
    Math.hypot(p.lat - lat, p.lng - lng) < Math.hypot(best.lat - lat, best.lng - lng) ? p : best,
  );
}

const fold = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** What India Post alone can say: a PIN code, or a district by name. Exported for a test. */
export async function indiaPostSuggestions(query: string): Promise<AddressSuggestion[]> {
  const pin = query.replace(/^\s*pin(?:\s*code)?\s*[:-]?\s*/i, "").trim();
  if (/^[1-9]\d{5}$/.test(pin)) {
    const place = lookUpPincode(pin);
    const at = place ? middleOf(await pincodePoints(pin).catch(() => [])) : null;
    if (!place || !at) return [];
    return [
      {
        label: `${pin} · ${joinParts([place.areas.slice(0, 2).join(", "), place.districts[0], place.state])}`,
        postalCode: pin,
        area: place.areas[0],
        city: place.districts[0],
        state: place.state,
        location: at,
        zoom: 14,
      },
    ];
  }

  const named = query.match(/^(.+?)\s+(?:district|zila|jila)$/i)?.[1];
  if (!named) return [];
  const wanted = fold(named);
  const out: AddressSuggestion[] = [];
  for (const district of listDistricts().filter((entry) => fold(entry.name) === wanted).slice(0, 3)) {
    const points = (await Promise.all(placesInDistrict(district.name, district.state).map((p) => pincodePoints(p.pincode).catch(() => [])))).flat();
    const at = middleOf(points);
    if (at) out.push({ label: `${district.name} district, ${district.state}`, city: district.name, state: district.state, location: at, zoom: 10 });
  }
  return out;
}

async function askPhoton(q: string, near?: LatLng | null): Promise<AddressSuggestion[]> {
  const base = (process.env.MAP_SEARCH_URL?.trim() || DEFAULT_SEARCH).replace(/\/+$/, "");
  const url =
    `${base}/api/?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}&lang=en&bbox=${INDIA_BBOX}` +
    (near ? `&lat=${near.lat}&lon=${near.lng}` : "");
  const res = await fetch(url, {
    headers: { "User-Agent": geocoderUserAgent(), Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  return readPhotonResponse((await res.json()) as { features?: PhotonFeature[] });
}

/** Indian scripts — Devanagari, Bengali, Gurmukhi, Gujarati, Tamil… — which Photon's public server does not search. */
const INDIC = /[ऀ-෿]/;

/**
 * Places for what has been typed, nudged towards `near`.
 *
 * `full` is a customer pressing Search: Nominatim is asked too, when Photon
 * found nothing or the words are not in Latin letters. Throws
 * `AddressSearchUnavailableError` only when nothing could be asked at all —
 * an empty list is an answer ("no such place"), a failure is not.
 */
export async function searchAddresses(query: string, near?: LatLng | null, { full = false } = {}): Promise<AddressSuggestion[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 3) return [];
  const id = `${full ? "full|" : ""}${q.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  const own = await indiaPostSuggestions(q);
  const indic = INDIC.test(q);
  let tried = 0;
  let failed = 0;

  // Photon as the customer types; for words in an Indian script only Nominatim can answer.
  let photon: AddressSuggestion[] = [];
  if (!(full && indic)) {
    tried += 1;
    try {
      photon = await askPhoton(q, near);
    } catch {
      failed += 1;
    }
  }

  let nominatim: AddressSuggestion[] = [];
  // Pressed: the customer did not find it among the suggestions, so the second service is asked too.
  if (full) {
    tried += 1;
    try {
      nominatim = readNominatimSearch(await searchNominatim(q));
    } catch (error) {
      if (!(error instanceof LocationServiceUnavailableError)) throw error;
      failed += 1;
    }
  }

  // Unavailable is every service asked failing with nothing of the shop's own to show.
  if (!own.length && tried > 0 && failed === tried) throw new AddressSearchUnavailableError();

  const seen = new Set<string>();
  const results = (await withIndiaPostPins([...nominatim, ...photon]))
    .filter((place) => {
      const key = `${place.location.lat.toFixed(4)},${place.location.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const all = [...own, ...results].slice(0, MAX_RESULTS);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(id, { results: all, at: Date.now() });
  return all;
}
