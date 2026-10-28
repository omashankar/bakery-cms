import "server-only";

import type { LatLng } from "@/types/delivery";
import { distanceKm } from "@/features/commerce/lib/delivery-area";

/**
 * THE PIN CODE AT A MAP PIN — from where India Post's own post offices stand.
 *
 * The owner asked (2026-10-28) for the right place and PIN wherever the pin is
 * dropped. OpenStreetMap's Indian postal codes are patchy and sometimes wrong
 * (it gave Sangod 325600, which no post office has, and Borkheda 324001 where
 * India Post says 324002), so the PIN is read from India Post instead: the
 * PIN of the post offices nearest the pin. Measured on 14 known places
 * (2026-10-28) it was right in all of Kota and Sangod, and in the dense parts
 * of Mumbai, Bengaluru and Kolkata the right PIN was among the nearest two or
 * three — which is why a close call says so and offers the others.
 *
 * Needs no network: the points are in data/india-pincode-points.json, built
 * by scripts/build-pincode-directory.mjs, loaded on the first question (1.7 MB
 * — server only, never in a page).
 */

export interface PincodeNearby {
  /** The PIN of the post offices nearest the pin. */
  pincode: string;
  /** How far its nearest office is, in km. */
  km: number;
  /**
   * False when another PIN's office is about as close — a PIN boundary runs
   * near here, and the customer should be shown the others.
   */
  sure: boolean;
  /** Other PINs with an office close by, nearest first — the "Not your PIN?" choices. */
  others: string[];
}

interface Points {
  updated: string;
  pins: Record<string, number[]>;
}

interface Office {
  pin: string;
  lat: number;
  lng: number;
}

/** ~5.5 km a cell: a city's offices fall in a handful of cells. */
const CELL = 0.05;
/** Look no further than this many cells out (~33 km): beyond that, no office is "at" the pin. */
const MAX_RING = 6;
/** Enough offices to see whether one PIN or several are about. */
const ENOUGH = 12;
/** Another PIN's office within this factor of the nearest makes it a close call… */
const CLOSE_FACTOR = 1.5;
/** …or within this many km, however near the nearest is. */
const CLOSE_KM = 0.5;
/** "Not your PIN?" offers PINs whose office is within this of the nearest. */
const OTHERS_KM = 3;
const MAX_OTHERS = 3;

const cellOf = (value: number) => Math.floor(value / CELL);
const keyOf = (row: number, col: number) => `${row}:${col}`;

let points: Promise<Points> | null = null;

function loadPoints(): Promise<Points> {
  points ??= import("./data/india-pincode-points.json")
    .then((module) => ((module as { default?: Points }).default ?? module) as Points)
    .catch((error: unknown) => {
      points = null;
      throw error;
    });
  return points;
}

/** Where a PIN's own post offices stand — empty when India Post gives none a usable place. */
export async function pincodePoints(pincode: string): Promise<LatLng[]> {
  const flat = (await loadPoints()).pins[pincode] ?? [];
  const out: LatLng[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ lat: flat[i] / 1e4, lng: flat[i + 1] / 1e4 });
  return out;
}

let grid: Promise<Map<string, Office[]>> | null = null;

function loadGrid(): Promise<Map<string, Office[]>> {
  grid ??= loadPoints()
    .then((data) => {
      const cells = new Map<string, Office[]>();
      for (const [pin, flat] of Object.entries(data.pins)) {
        for (let i = 0; i + 1 < flat.length; i += 2) {
          const office = { pin, lat: flat[i] / 1e4, lng: flat[i + 1] / 1e4 };
          const key = keyOf(cellOf(office.lat), cellOf(office.lng));
          const list = cells.get(key);
          if (list) list.push(office);
          else cells.set(key, [office]);
        }
      }
      return cells;
    })
    .catch((error: unknown) => {
      grid = null;
      throw error;
    });
  return grid;
}

/** The offices nearest the point, nearest first — none further than MAX_RING cells. */
async function officesNear(point: LatLng): Promise<{ office: Office; km: number }[]> {
  const cells = await loadGrid();
  const row = cellOf(point.lat);
  const col = cellOf(point.lng);
  const found: Office[] = [];
  let enoughAt = -1;
  for (let ring = 0; ring <= MAX_RING; ring += 1) {
    for (let r = row - ring; r <= row + ring; r += 1) {
      for (let c = col - ring; c <= col + ring; c += 1) {
        // Only the ring's edge: the inside was read on earlier turns.
        if (Math.max(Math.abs(r - row), Math.abs(c - col)) !== ring) continue;
        const list = cells.get(keyOf(r, c));
        if (list) found.push(...list);
      }
    }
    // One ring more once there are enough: an office in the next cell can be nearer than one in a corner of this.
    if (enoughAt < 0 && found.length >= ENOUGH) enoughAt = ring;
    if (enoughAt >= 0 && ring > enoughAt) break;
  }
  return found
    .map((office) => ({ office, km: distanceKm(point, office) }))
    .sort((a, b) => a.km - b.km);
}

/**
 * The PIN at a map pin, or null where no post office is within ~30 km (the
 * sea, or a pin outside India).
 *
 * OpenStreetMap's postal code is NOT asked to settle a close call: at
 * Borkheda it says 324001, India Post 324002 — the very kind of spot a
 * tie-break would decide. A close call is said, with the neighbours offered.
 */
export async function pincodeNear(point: LatLng): Promise<PincodeNearby | null> {
  const near = await officesNear(point);
  if (!near.length) return null;

  // Each PIN once, at its nearest office.
  const byPin: { pin: string; km: number }[] = [];
  for (const { office, km } of near) {
    if (!byPin.some((entry) => entry.pin === office.pin)) byPin.push({ pin: office.pin, km });
  }
  const [nearest, rival] = byPin;
  const close = Boolean(rival && rival.km <= Math.max(nearest.km * CLOSE_FACTOR, nearest.km + CLOSE_KM));

  return {
    pincode: nearest.pin,
    km: Math.round(nearest.km * 100) / 100,
    sure: !close,
    others: byPin
      .slice(1)
      .filter((entry) => entry.km <= nearest.km + OTHERS_KM)
      .slice(0, MAX_OTHERS)
      .map((entry) => entry.pin),
  };
}
