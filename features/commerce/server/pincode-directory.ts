import "server-only";

import type { DistrictEntry, PincodeInfo, PincodePlace } from "@/types/delivery";
import directory from "./data/india-pincodes.json";

/**
 * EVERY REAL PIN CODE IN INDIA — what India Post says is at each one.
 *
 * Zones were matched on guesses: the state from the first three digits, a
 * city from whatever the customer typed in the City box. So "Kotah" was not
 * Kota, a typo was a valid address, and a PIN prefix like "3240" claimed to
 * cover a hundred codes when ten exist. This answers from India Post's own
 * directory (see scripts/build-pincode-directory.mjs for where it comes from
 * and how to refresh it — `npm run pincodes:update`): every PIN code, its
 * district and state, and the post-office areas inside it.
 *
 * SERVER ONLY. 1.2 MB of data has no place in a page's JavaScript; browsers
 * ask /api/pincodes for the one code they need.
 */

type Row = [stateIndex: number, districts: number | number[], areas: string];

interface Directory {
  source: string;
  /** When India Post last refreshed the list this was built from. */
  updated: string;
  states: string[];
  districts: [name: string, stateIndex: number][];
  pins: Record<string, Row>;
}

const data = directory as unknown as Directory;

export const PINCODE_DIRECTORY_SOURCE = data.source;
/** "2025-10-03" — shown to the owner, so a stale list is visible. */
export const PINCODE_DIRECTORY_UPDATED = data.updated;

/** How big and how fresh the list is, for the zones screen. */
export function describeDirectory() {
  return {
    updated: data.updated,
    pins: Object.keys(data.pins).length,
    districts: data.districts.length,
    source: data.source,
  };
}

function placeOf(pincode: string, row: Row): PincodePlace {
  const [stateIndex, districts, areas] = row;
  return {
    pincode,
    state: data.states[stateIndex],
    districts: (Array.isArray(districts) ? districts : [districts]).map((i) => data.districts[i][0]),
    areas: areas ? areas.split("|") : [],
  };
}

/** The place at a six-digit PIN, or null when India Post lists no such code. */
export function lookUpPincode(pincode: string): PincodePlace | null {
  const row = data.pins[pincode];
  return row ? placeOf(pincode, row) : null;
}

/** Sorted once, on first use, so a prefix is two binary searches. */
let sortedPins: string[] | null = null;

function pinsStartingWith(prefix: string): string[] {
  sortedPins ??= Object.keys(data.pins).sort();
  let lo = 0;
  let hi = sortedPins.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedPins[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const out: string[] = [];
  for (let i = lo; i < sortedPins.length && sortedPins[i].startsWith(prefix); i += 1) {
    out.push(sortedPins[i]);
  }
  return out;
}

/**
 * What a code means: one place for six digits, a summary for a prefix — how
 * many real PINs start with it and which districts they are in. "3240" is ten
 * PINs, all in Kota; "3420" is none, which is how a typo shows itself.
 */
export function describePincodeCode(code: string): PincodeInfo {
  if (code.length === 6) return { kind: "pin", code, place: lookUpPincode(code) };
  const pins = pinsStartingWith(code);
  const districts = new Set<string>();
  const states = new Set<string>();
  for (const pin of pins) {
    const place = lookUpPincode(pin)!;
    place.districts.forEach((district) => districts.add(district));
    states.add(place.state);
  }
  return {
    kind: "prefix",
    code,
    summary: {
      prefix: code,
      count: pins.length,
      districts: [...districts].sort(),
      states: [...states].sort(),
    },
  };
}

/**
 * The real PINs a half-typed code could be, lowest first — the list under a
 * PIN box as the customer types. "3240" → 324001 Kota, 324002 Kota …; a code
 * no PIN starts with gives none, which is how a typo shows itself.
 */
export function suggestPincodes(prefix: string, limit = 10): PincodePlace[] {
  return pinsStartingWith(prefix)
    .slice(0, limit)
    .map((pin) => lookUpPincode(pin)!);
}

let districtList: DistrictEntry[] | null = null;

/** Every district, with its state and how many PIN codes it has. */
export function listDistricts(): DistrictEntry[] {
  if (districtList) return districtList;
  const counts = new Array<number>(data.districts.length).fill(0);
  for (const [, districts] of Object.values(data.pins)) {
    for (const i of Array.isArray(districts) ? districts : [districts]) counts[i] += 1;
  }
  districtList = data.districts
    .map(([name, stateIndex], i) => ({ name, state: data.states[stateIndex], pins: counts[i] }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.state.localeCompare(b.state));
  return districtList;
}

/** District index → its PINs, built once, on first use. */
let pinsByDistrict: Map<number, string[]> | null = null;

/**
 * Every PIN in a district, as places. Two states can each have a district of
 * the same name (Bilaspur, Aurangabad), so the state picks which one.
 */
export function placesInDistrict(name: string, state: string): PincodePlace[] {
  if (!pinsByDistrict) {
    pinsByDistrict = new Map();
    for (const [pin, [, districts]] of Object.entries(data.pins)) {
      for (const i of Array.isArray(districts) ? districts : [districts]) {
        const list = pinsByDistrict.get(i) ?? [];
        list.push(pin);
        pinsByDistrict.set(i, list);
      }
    }
  }
  const index = data.districts.findIndex(
    ([districtName, stateIndex]) => districtName === name && data.states[stateIndex] === state,
  );
  return (pinsByDistrict.get(index) ?? []).map((pin) => placeOf(pin, data.pins[pin]));
}
