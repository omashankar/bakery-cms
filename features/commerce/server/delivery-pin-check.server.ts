import "server-only";

import type { DeliveryPinVerification, DeliveryZone, DeliveryZoneMatch, LatLng } from "@/types/delivery";
import {
  findAreaZone,
  findDeliveryZoneForPin,
  hasActiveRegionZones,
  isValidLatLng,
  kmToNearestArea,
  type PinRegion,
} from "@/features/commerce/lib/delivery-area";
import { OUTSIDE_ZONES_MESSAGE } from "@/features/commerce/lib/delivery-zone-utils";
import { matchStateName } from "@/features/commerce/lib/india-states";
import { LocationServiceUnavailableError, reverseGeocode, type GeocodedPlace } from "./osm-geocoding.server";
import { listDistricts, lookUpPincode } from "./pincode-directory";
import { pincodeNear, type PincodeNearby } from "./pincode-locator";

/**
 * IS THE CUSTOMER'S MAP PIN SOMEWHERE THE SHOP DELIVERS, AND DOES IT AGREE
 * WITH THE ADDRESS THEY TYPED?
 *
 * In this order:
 *
 * 1. a pin at all, and a real one;
 * 2. an active area zone holds it — pure geometry, the shop's own code, free
 *    and always available. THIS is the check that refuses the Kota address
 *    with Sangod's PIN, and it never depends on anyone's map service;
 * 3. the PIN at the pin — India Post's, from its nearest post offices (see
 *    pincode-locator.ts) — and the state OpenStreetMap names there, compared
 *    with the address. Refused when no PIN near the pin is in the typed
 *    PIN's DISTRICT, or the state is a different one.
 *
 * Where no post office is near (the sea, a pin outside India) there is no PIN
 * to compare, and the order goes through on the area check alone, recording
 * that the PIN was not confirmed (owner, 2026-10-27: "PIN na mile to order
 * hone do"). OpenStreetMap being down no longer leaves the PIN unknown: the
 * post offices are the shop's own data. The city is compared too but never refuses: people
 * write their tehsil town, the map its district, and both are right.
 *
 * The pin itself comes from the browser, and nobody can know where the
 * customer really is. What can be refused is a pin outside the area, and an
 * address that contradicts its own pin.
 */

export type DeliveryPinProblem = "missing" | "invalid" | "outside" | "mismatch";

export type DeliveryPinVerdict =
  | {
      status: "eligible";
      /** Null only on a shop that delivers outside its zones, at its fallback fee. */
      zone: DeliveryZoneMatch["zone"] | null;
      /** The pin's district and state, which priced a whole-district or whole-state zone. */
      region: PinRegion;
      verification: DeliveryPinVerification;
      /** Said, not refused: the town the map names when it differs from the City box. */
      cityNote?: string;
      /** "Borkhera, Kota" — the pin as a customer names it, for the header. Absent when the map did not say. */
      placeName?: string;
      /** The PIN at the pin, how sure, and its neighbours — null where no post office is near. */
      nearby: PincodeNearby | null;
      /** The town and state at the pin, for filling address boxes the customer left empty. */
      city: string | null;
      state: string | null;
    }
  | {
      status: DeliveryPinProblem;
      message: string;
      /** The address box the customer should look at. */
      field?: "location" | "pincode" | "state";
      /** The map's answer, when there was one — the checkout offers its PIN. */
      found?: Pick<GeocodedPlace, "postalCode" | "city" | "state" | "formattedAddress">;
      /** Outside: how far the nearest area drawn on the map is, km — the next street, or the next town. */
      kmToArea?: number;
    };

export interface DeliveryPinInput {
  location?: LatLng | null;
  pincode?: string;
  city?: string;
  state?: string;
  /** The shop's zones, read fresh for this request — a zone switched off a minute ago no longer counts. */
  zones: DeliveryZone[];
  /** `commerce.deliverOutsideZones`: true lets a pin outside every zone through at the fallback fee. */
  deliverOutsideZones: boolean;
}

const fold = (text: string | null | undefined) =>
  (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The pin's state and district, as India Post spells them.
 *
 * From the map when it answered: its state, and its district matched to India
 * Post's names (OpenStreetMap writes "Kota" or "Kota District"; a zone stores
 * India Post's). When the map named no district India Post knows, the typed
 * PIN's district stands in — the PIN AT the pin first, then the typed one,
 * each only if it is in the pin's own state. When the map named no Indian
 * state (it was down, or the pin is abroad), the PIN at the pin decides, per
 * India Post — the map being down does not stop an order. Never the typed
 * PIN alone: a pin at sea with Kota's PIN typed was priced as Kota district.
 */
function regionFor(place: GeocodedPlace | null, entered: string, atPin: string | null): PinRegion {
  const typed = entered ? lookUpPincode(entered) : null;
  const pinPlace = atPin ? lookUpPincode(atPin) : null;
  const state = matchStateName(place?.state ?? "");
  if (!state) {
    return pinPlace ? { state: pinPlace.state, districts: pinPlace.districts } : { state: null, districts: [] };
  }

  const wanted = fold((place?.district ?? "").replace(/\bdistrict\b/i, ""));
  const known = wanted
    ? listDistricts()
        .filter((district) => matchStateName(district.state) === state && fold(district.name) === wanted)
        .map((district) => district.name)
    : [];
  const pinHere = pinPlace && matchStateName(pinPlace.state) === state ? pinPlace.districts : [];
  const typedHere = typed && matchStateName(typed.state) === state ? typed.districts : [];
  return { state, districts: known.length ? known : pinHere.length ? pinHere : typedHere };
}

/**
 * The address at the pin, as a customer writes it: OpenStreetMap's words for
 * the place with India Post's PIN — never the map's own postal code, the part
 * it gets wrong — and without "India".
 */
export function addressAt(place: GeocodedPlace | null, pincode: string | null): string {
  const words = (place?.formattedAddress ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^\d{6}$/.test(part) && part.toLowerCase() !== "india")
    // "Kota, Ladpura Tehsil, Kota": the city and its district, said once.
    .filter((part, i, all) => all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === i);
  if (!words.length && pincode) {
    // No map answer: the PIN's own post office area, district and state.
    const known = lookUpPincode(pincode);
    if (known) words.push(...[known.areas[0], known.districts[0], known.state].filter((part): part is string => Boolean(part)));
  }
  if (!words.length) return "";
  return pincode ? `${words.join(", ")} ${pincode}` : words.join(", ");
}

/**
 * "Outside our delivery area" — with where the pin is and how far the nearest
 * area is. Said bare, a customer whose phone put the pin a town away (a
 * computer's location is a guess from its network) could not tell a wrong pin
 * from a shop that does not come to them (owner, 2026-10-28). From the shop's
 * own data: India Post's offices for the place, the zones for the distance —
 * no map service is asked about a pin that is refused anyway.
 */
async function outsideAt(
  location: LatLng,
  zones: DeliveryZone[],
  place: GeocodedPlace | null,
  nearby?: PincodeNearby | null,
): Promise<DeliveryPinVerdict> {
  const near = nearby === undefined ? await pincodeNear(location).catch(() => null) : nearby;
  const pin = near?.pincode ?? null;
  const known = pin ? lookUpPincode(pin) : null;
  const km = kmToNearestArea(zones, location);
  return {
    status: "outside",
    field: "location",
    message: OUTSIDE_ZONES_MESSAGE,
    found: {
      postalCode: pin,
      city: place?.city ?? known?.districts[0] ?? null,
      state: place?.state ?? known?.state ?? null,
      formattedAddress: addressAt(place, pin),
    },
    ...(Number.isFinite(km) ? { kmToArea: Math.round(km * 10) / 10 } : {}),
  };
}

export async function verifyDeliveryPin(input: DeliveryPinInput): Promise<DeliveryPinVerdict> {
  if (!input.location) {
    return {
      status: "missing",
      field: "location",
      message: "Please pin your delivery location on the map.",
    };
  }
  if (!isValidLatLng(input.location)) {
    return {
      status: "invalid",
      field: "location",
      message: "That map location is not a real place. Please pin your delivery location again.",
    };
  }
  const location = { lat: input.location.lat, lng: input.location.lng };

  // A drawn area is answered by geometry alone — free, instant, and needing
  // no map service. Only a pin outside every drawn area, on a shop with
  // whole-district or whole-state zones, needs to know where it is by name.
  const drawn = findAreaZone(input.zones, location);
  const needsRegion = !drawn && hasActiveRegionZones(input.zones);
  if (!drawn && !needsRegion && !input.deliverOutsideZones) {
    return outsideAt(location, input.zones, null);
  }

  // The map's answer is a second opinion. When it cannot be had, the area
  // check above has already decided — say so on the order, and go on.
  let place: GeocodedPlace | null = null;
  let lookup: DeliveryPinVerification["pincodeCheck"] = "matched";
  try {
    place = await reverseGeocode(location);
  } catch (error) {
    if (!(error instanceof LocationServiceUnavailableError)) throw error;
    lookup = "unavailable";
  }

  // Where the pin is by India Post's own offices — needs no map service, and
  // never takes the map's postal code (see pincode-locator.ts).
  const nearby = await pincodeNear(location);
  const atPin = nearby?.pincode ?? null;

  const entered = (input.pincode ?? "").replace(/\D/g, "");
  const region = regionFor(place, entered, atPin);
  const match = drawn ?? findDeliveryZoneForPin(input.zones, location, region);
  if (!match && !input.deliverOutsideZones) {
    return outsideAt(location, input.zones, place, nearby);
  }

  const atPinPlace = atPin ? lookUpPincode(atPin) : null;
  const found = {
    postalCode: atPin,
    city: place?.city ?? atPinPlace?.districts[0] ?? null,
    state: place?.state ?? atPinPlace?.state ?? null,
    formattedAddress: addressAt(place, atPin),
  };

  // The PIN at the pin, against the one typed. A PIN boundary is a line on
  // nobody's map, so a typed PIN that is one of the PINs NEAR the pin, or in
  // the same district, is a note; only a PIN in another district contradicts
  // the address.
  //
  // A typed PIN India Post has never had is a typo, not a place: it passed as
  // "same district" — nothing to compare — and the order said so (zone
  // review, 2026-10-28). Refused, with the PIN at the pin offered instead.
  if (entered && !lookUpPincode(entered)) {
    return {
      status: "mismatch",
      field: "pincode",
      message: atPin
        ? `${entered} is not a PIN code India Post has. The map location is in PIN ${atPin} — please check the PIN code.`
        : `${entered} is not a PIN code India Post has. Please check the PIN code.`,
      found,
    };
  }
  if (!nearby) {
    if (lookup !== "unavailable") lookup = "not-on-map";
  } else if (entered && atPin !== entered) {
    const near = [atPin!, ...nearby.others];
    const typedPlace = lookUpPincode(entered)!;
    const sameDistrict = near.some(
      (pin) => lookUpPincode(pin)?.districts.some((district) => typedPlace.districts.includes(district)) ?? false,
    );
    if (!sameDistrict) {
      return {
        status: "mismatch",
        field: "pincode",
        message: `The map location is in PIN ${atPin}${atPinPlace ? ` (${atPinPlace.districts[0]})` : ""}, but the address says ${entered}. Please correct the PIN code or move the pin.`,
        found,
      };
    }
    lookup = "nearby";
  } else {
    // Known from India Post whether or not the map answered.
    lookup = "matched";
  }

  if (place) {

    const pinState = matchStateName(place.state ?? "");
    // The map names a state far more reliably than a PIN. A typed PIN whose
    // state (per India Post) is not the pin's is a different place, whatever
    // the map's postal code was — a Delhi PIN on a Sangod pin.
    const typedPinState = entered ? matchStateName(lookUpPincode(entered)?.state ?? "") : null;
    const typedState = matchStateName(input.state ?? "");
    if (typedPinState && pinState && typedPinState !== pinState) {
      // The PIN and the State box agree, so it is the PIN on the map that is elsewhere.
      const pinIsWrong = Boolean(typedState) && typedState !== typedPinState;
      return {
        status: "mismatch",
        field: pinIsWrong ? "pincode" : "location",
        message: pinIsWrong
          ? `PIN ${entered} is in ${typedPinState}, but the map location is in ${pinState}. Please correct the PIN code or move the pin.`
          : `The map location is in ${pinState}, but the address is in ${typedPinState}. Please move the pin to the address, or correct the address.`,
        found,
      };
    }

    if (typedState && pinState && typedState !== pinState) {
      return {
        status: "mismatch",
        field: "state",
        message: `The map location is in ${pinState}, but the address says ${typedState}. Please correct the state or move the pin.`,
        found,
      };
    }
  }

  const placeName = [place?.locality, place?.city ?? place?.district]
    .filter((part, i, all): part is string => Boolean(part) && all.indexOf(part) === i)
    .join(", ");

  const city = fold(input.city);
  const named = [place?.city, place?.district].map(fold).filter(Boolean);
  const cityNote =
    city && named.length && !named.some((name) => name === city || name.includes(city) || city.includes(name))
      ? `The map places this pin in ${place?.city ?? place?.district}.`
      : undefined;

  return {
    status: "eligible",
    zone: match?.zone ?? null,
    region,
    verification: {
      lat: location.lat,
      lng: location.lng,
      postalCode: atPin,
      pincodeCheck: lookup,
      formattedAddress: found.formattedAddress,
      zoneId: match?.zone.id ?? "",
      verifiedAt: new Date().toISOString(),
    },
    ...(cityNote ? { cityNote } : {}),
    ...(placeName ? { placeName } : {}),
    nearby,
    city: found.city,
    state: found.state,
  };
}
