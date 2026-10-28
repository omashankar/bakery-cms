import "server-only";

import type { DeliveryZone, LatLng } from "@/types/delivery";
import { findDeliveryZoneForPin, findRegionZone, hasUsableArea, isAreaZone } from "@/features/commerce/lib/delivery-area";
import { lookUpPincode } from "./pincode-directory";
import { pincodePoints } from "./pincode-locator";

/**
 * "DO YOU DELIVER TO 324002?" — answered from where that PIN's post offices
 * stand, by the same zone rules checkout uses.
 *
 * The product page, cart and header answer by PIN (owner, 2026-10-27: "yes ya
 * no"). With areas drawn on the map a PIN could not say, so the browser
 * searched OpenStreetMap for the PIN's area by NAME and asked about the spot
 * it found — and "Borkhera, Kota" finds two villages 40 km apart. India Post
 * says where each of the PIN's offices is; each is put through the zone rules
 * (drawn area first, then district, then state), and:
 *
 * - most offices delivered (three in four) → yes, at the charge most get;
 * - fewer → "parts of this PIN": the door decides;
 * - none → no (or the shop's fallback fee, where it delivers outside zones).
 *
 * Most, not all: Kota's 324002 has eight offices and one, a village, sits
 * 300 m past a 10 km circle — "parts of 324002" for the railway station's own
 * PIN would be a worse answer than yes. Checkout still refuses that village.
 *
 * Still an estimate: checkout checks the actual door before any order is priced.
 */

export type PincodeAnswer =
  | { status: "unknown" }
  | { status: "outside" }
  | { status: "partly" }
  | {
      status: "eligible";
      /** Null for the shop's fallback, outside every zone. */
      zone: DeliveryZone | null;
      /** Offices of this PIN are charged differently — a door may pay another rate. */
      priceMayVary: boolean;
      /**
       * One of the PIN's offices that gets this answer, for pricing a cart
       * that has no pin yet. Never a door: nothing may put a delivery pin here.
       */
      at?: LatLng;
    };

/** The share of a PIN's offices that must be delivered for a plain yes. */
const MOSTLY = 0.75;

export async function answerPincode(pincode: string, zones: DeliveryZone[], deliverOutsideZones: boolean): Promise<PincodeAnswer> {
  const place = lookUpPincode(pincode);
  if (!place) return { status: "unknown" };
  const region = { state: place.state, districts: place.districts };
  const points = await pincodePoints(pincode).catch(() => []);
  const drawn = zones.some((zone) => zone.isActive && isAreaZone(zone) && hasUsableArea(zone));

  if (points.length === 0) {
    // No office with a usable place: the district or state still answers; a drawn area cannot.
    const match = findRegionZone(zones, region);
    if (match) return { status: "eligible", zone: match.zone, priceMayVary: drawn };
    if (drawn) return { status: "partly" };
    return deliverOutsideZones ? { status: "eligible", zone: null, priceMayVary: false } : { status: "outside" };
  }

  const matches = points.map((point) => findDeliveryZoneForPin(zones, point, region)?.zone ?? null);
  const served = matches.filter((zone): zone is DeliveryZone => zone !== null);

  if (served.length === 0) {
    return deliverOutsideZones ? { status: "eligible", zone: null, priceMayVary: false, at: points[0] } : { status: "outside" };
  }
  if (served.length < matches.length * MOSTLY && !deliverOutsideZones) return { status: "partly" };

  // What most of the PIN's offices get — the fallback counted too, so one
  // office in a cheap circle does not speak for seven paying the fallback. A
  // tie goes to a zone over the fallback, then to the cheaper zone.
  const counts = new Map<DeliveryZone | null, number>();
  for (const zone of matches) counts.set(zone, (counts.get(zone) ?? 0) + 1);
  const chargeOf = (zone: DeliveryZone | null) => (zone ? zone.deliveryCharge : Number.POSITIVE_INFINITY);
  const [zone] = [...counts.entries()].sort((a, b) => b[1] - a[1] || chargeOf(a[0]) - chargeOf(b[0]))[0];
  const charges = new Set(matches.map((match) => match?.deliveryCharge ?? null));
  return { status: "eligible", zone, priceMayVary: charges.size > 1, at: points[matches.indexOf(zone)] };
}
