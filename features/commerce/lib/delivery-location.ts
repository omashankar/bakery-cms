import { safeRemoveItem, safeSetItem } from "@/lib/safe-storage";
import type { DeliveryZone, PincodePlace } from "@/types/delivery";
import type { CommerceSettings } from "@/types/settings";
import { isFullPincode, normalizePincode } from "./delivery-zone-utils";
import { decidesDelivery, findRegionZone, hasUsableArea, isAreaZone, isValidLatLng } from "./delivery-area";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { getActiveLocale } from "@/features/settings/lib/active-locale";
import { isPastSameDayCutoff, sameDayCutoffFor, shopClockNow, todayAsDateString } from "@/features/orders/lib/delivery-date";

/**
 * WHERE THE CUSTOMER IS HAVING IT SENT.
 *
 * The reference storefront carries this in the header, beside the search box,
 * because it changes what the rest of the page means: a price with no delivery
 * charge in it and a promise with no zone behind it are both answers to a
 * question nobody has asked yet.
 *
 * Everything here is derived from the shop's OWN delivery zones. This module
 * states no coverage, no speed and no charge of its own — every figure it
 * returns was typed into Commerce → Delivery Zones by the shop, and when the
 * shop has configured nothing there is nothing to say and the control does not
 * render at all (see `hasDeliveryZones` in storefront-chrome).
 */

const STORAGE_KEY = "bakery-cms-delivery-location";

/**
 * Bumped when the label's meaning changed — 2: the customer's place, no
 * longer a zone name; 3: "324001, Kota", the PIN first, as the reference shop
 * writes it.
 */
const LABEL_VERSION = 3;

/** "324005, Kota" — a PIN as the customer reads it, with India Post's district. */
export function pincodeLabel(pincode: string, place?: PincodePlace | null): string {
  const district = place?.districts[0];
  return district ? `${pincode}, ${district}` : pincode;
}

/** "Talwandi Circle" — the first part of a found place's name, short enough for the header. */
export function placeLabel(label: string): string {
  return label.split(",")[0]?.trim().slice(0, 40) ?? "";
}

/** Other parts of the storefront can follow the choice without prop-drilling. */
export const DELIVERY_LOCATION_UPDATED_EVENT = "bakery-delivery-location-updated";

export interface DeliveryLocation {
  /** Digits only, as `normalizePincode` leaves it. */
  pincode: string;
  /**
   * What to show on the button — the CUSTOMER'S place ("Kota 324005",
   * "Talwandi Circle"), never the shop's zone name. Zone names are the
   * owner's own words ("sangod", "₹40 areas", "Rest of Kota district") and
   * read as nonsense on a customer's header; they also outlive the zone,
   * and "Deliver to sangod" stayed up after that zone was deleted.
   *
   * Stored rather than re-derived, because the zone list is fetched lazily and
   * the header renders before it arrives. Re-deriving would mean the button
   * said "Delivery location" for a moment on every page load, for a customer
   * who had already chosen one.
   */
  label: string;
  /**
   * The exact spot the customer checked, when they checked one — so the
   * checkout map opens with the pin already on their door. A convenience:
   * the server checks the pin again when the order is priced.
   */
  location?: import("@/types/delivery").DeliveryPin;
}

function parse(raw: string | null): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as (Partial<DeliveryLocation> & { v?: number }) | null;
    const pincode = normalizePincode(String(value?.pincode ?? ""));
    const location = isValidLatLng(value?.location) ? { lat: value.location.lat, lng: value.location.lng } : undefined;
    if (!pincode && !location) return null;
    // A label saved before v2 was a zone's name: dropped, so the PIN shows instead.
    const label = value?.v === LABEL_VERSION ? String(value?.label ?? "").trim() : "";
    return { pincode, label, ...(location ? { location } : {}) };
  } catch {
    // A hand-edited or half-written value is the same as none: this is a
    // convenience, and refusing to render the header over it would be worse
    // than forgetting one pincode.
    return null;
  }
}

export function readDeliveryLocation(): DeliveryLocation | null {
  if (typeof window === "undefined") return null;
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // A browser set to block site data throws on ACCESS, not only on write.
    return null;
  }
}

export function saveDeliveryLocation(next: DeliveryLocation | null): void {
  if (typeof window === "undefined") return;
  if (next) {
    safeSetItem(STORAGE_KEY, JSON.stringify({ ...next, v: LABEL_VERSION }));
  } else {
    // Forgetting the pincode is the whole operation, so a storage failure
    // here has nothing to recover and nothing to tell the customer.
    safeRemoveItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(DELIVERY_LOCATION_UPDATED_EVENT));
}

export interface DeliveryLookup {
  /** True only when one of the SHOP's own active zones matched. */
  served: boolean;
  /** The zone's own name, or "" when nothing matched. */
  zoneName: string;
  /**
   * The zone's own minimum days, or null.
   *
   * Null rather than 0 where the zone does not say, because 0 means same-day —
   * a promise — and a missing value is not one.
   */
  minDeliveryDays: number | null;
  /** The zone's own charge, or null when it does not state one. */
  charge: number | null;
  /**
   * Where the PIN is, per India Post — "Talwandi, Kota" is how a customer
   * knows the right code was checked. Absent when it was not looked up.
   */
  place?: PincodePlace | null;
  /** India Post lists no such PIN: a typo, not a place the shop skips. */
  unknownPincode?: boolean;
  /**
   * The shop delivers by map area, so a PIN alone cannot answer: the customer
   * pins their door at checkout. `areaNames` are the areas it delivers in.
   */
  needsPin?: boolean;
  areaNames?: string[];
  /** A drawn area inside this district or state may charge less at one door. */
  priceMayVary?: boolean;
}

/**
 * What the shop's zones say about a pincode.
 *
 * Returns null for an unusable entry, so the caller can tell "nothing typed
 * yet" from "typed, and not served" — those are different things to show, and
 * collapsing them is how a customer gets told a shop does not deliver to them
 * before they have finished typing.
 */
export function lookUpDeliveryPincode(
  zones: DeliveryZone[],
  entered: string,
  /**
   * The shop's delivery rules, so this answers what CHECKOUT will do. Without
   * them it judged by the zones alone and said "not covered" to an address
   * checkout then charged the fallback fee — or to any address at all on a
   * shop with zone pricing switched off.
   */
  rules?: Pick<
    CommerceSettings,
    "useZoneBasedDelivery" | "deliverOutsideZones" | "zoneFallbackDeliveryFee" | "deliveryFee"
  >,
  /**
   * India Post's answer for the PIN: a place, null for "no such PIN", or
   * undefined when it could not be asked — then the zones answer from the
   * digits alone, as checkout would.
   */
  place?: PincodePlace | null,
): DeliveryLookup | null {
  const pincode = normalizePincode(entered);
  // Five digits is still typing, not an answer either way.
  if (!isFullPincode(pincode)) return null;

  // A code India Post does not list is a typo far more often than a new PIN:
  // say so, rather than "we deliver" to a place that may not exist.
  if (place === null) {
    return { served: false, zoneName: "", minDeliveryDays: null, charge: null, place, unknownPincode: true };
  }

  // Zones off: every address is delivered at the shop's flat fee.
  if (rules && !rules.useZoneBasedDelivery) {
    return { served: true, zoneName: "", minDeliveryDays: null, charge: rules.deliveryFee, place };
  }

  /*
    THE MAP PIN DECIDES, NOT THE PIN CODE (owner, 2026-10-27).

    This answered from PIN-code zones: "Yes, we deliver to 325601" — and a
    Kota address with that PIN was then taken for Sangod. A PIN covers
    villages miles apart, so with delivery areas drawn on the map the honest
    answer is that it depends on the door, which the customer pins at
    checkout. PIN, district and state zones answer nothing now.
  */
  const deciding = zones.filter(
    (zone) => zone.isActive && decidesDelivery(zone) && (!isAreaZone(zone) || hasUsableArea(zone)),
  );
  const drawn = deciding.filter(isAreaZone);

  // A whole district or state the PIN is in (India Post says which): that is
  // an answer the PIN CAN give. A circle drawn inside it may still be cheaper
  // for one door — said, so the price at checkout is no surprise.
  const region = place ? findRegionZone(deciding, { state: place.state, districts: place.districts }) : null;
  if (region) {
    return {
      place,
      served: true,
      zoneName: region.zone.name?.trim() ?? "",
      minDeliveryDays: Number.isFinite(region.zone.minDeliveryDays) ? region.zone.minDeliveryDays : null,
      charge: Number.isFinite(region.zone.deliveryCharge) ? region.zone.deliveryCharge : null,
      ...(drawn.length ? { priceMayVary: true } : {}),
    };
  }

  // Only drawn areas, which a PIN cannot answer for: the door must be checked.
  if (drawn.length > 0) {
    return {
      served: true,
      needsPin: true,
      areaNames: drawn.map((zone) => zone.name.trim()).filter(Boolean),
      zoneName: "",
      minDeliveryDays: null,
      charge: null,
      place,
    };
  }
  // Districts or states, but India Post could not be asked: neither yes nor no.
  if (deciding.length > 0 && place === undefined) {
    return { served: true, needsPin: true, areaNames: deciding.map((zone) => zone.name.trim()).filter(Boolean), zoneName: "", minDeliveryDays: null, charge: null };
  }
  if (rules && rules.deliverOutsideZones !== false) {
    return {
      served: true,
      zoneName: "",
      minDeliveryDays: null,
      charge: rules.zoneFallbackDeliveryFee ?? rules.deliveryFee,
      place,
    };
  }
  return { served: false, zoneName: "", minDeliveryDays: null, charge: null, place };
}

/**
 * The button's own line.
 *
 * The customer's place when one was saved, else the PIN, and nothing at all
 * before a choice is made — the caller renders its own prompt then, rather
 * than this module inventing one.
 */
export function deliveryLocationLabel(location: DeliveryLocation | null): string {
  if (!location) return "";
  return location.label || location.pincode;
}

/**
 * The soonest a zone's delivery can come, as checkout's date picker will allow
 * it: the zone's own days or the shop's lead time, whichever is later — and a
 * same-day zone pushed to tomorrow once the shop's same-day cutoff has passed.
 * Null when the zone does not say.
 *
 * The PIN answer and the map said "Same-day delivery" from the zone's days
 * alone, while checkout's earliest date was tomorrow on a shop with a one-day
 * lead time (zone review, 2026-10-28). In the browser: it reads the shop's
 * settings and the minute.
 */
export function soonestDeliveryDays(zoneDays: number | null | undefined, now?: Date): number | null {
  if (typeof zoneDays !== "number" || !Number.isFinite(zoneDays)) return null;
  const commerce = getCommerceSettings();
  const days = Math.max(zoneDays, Number.isFinite(commerce.deliveryLeadDays) ? commerce.deliveryLeadDays : 0, 0);
  if (days > 0) return days;
  const clock = now ?? shopClockNow(getActiveLocale().timezone);
  const closes = sameDayCutoffFor(commerce.sameDayCutoff, 0);
  return closes && isPastSameDayCutoff(todayAsDateString(clock), closes, clock) ? 1 : 0;
}

/** "Same-day delivery", "From the next day", "From 3 days ahead" — for `soonestDeliveryDays`. */
export function soonestDeliveryText(days: number | null): string | null {
  if (days === null) return null;
  if (days <= 0) return "Same-day delivery";
  if (days === 1) return "From the next day";
  return `From ${days} days ahead`;
}
