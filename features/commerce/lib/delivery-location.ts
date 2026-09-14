import { safeRemoveItem, safeSetItem } from "@/lib/safe-storage";
import type { DeliveryZone } from "@/types/delivery";
import { findDeliveryZone, normalizePincode } from "./delivery-zone-utils";

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

/** Other parts of the storefront can follow the choice without prop-drilling. */
export const DELIVERY_LOCATION_UPDATED_EVENT = "bakery-delivery-location-updated";

export interface DeliveryLocation {
  /** Digits only, as `normalizePincode` leaves it. */
  pincode: string;
  /**
   * What to show on the button — the matched zone's own name.
   *
   * Stored rather than re-derived, because the zone list is fetched lazily and
   * the header renders before it arrives. Re-deriving would mean the button
   * said "Delivery location" for a moment on every page load, for a customer
   * who had already chosen one.
   */
  label: string;
}

function parse(raw: string | null): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DeliveryLocation> | null;
    const pincode = normalizePincode(String(value?.pincode ?? ""));
    if (!pincode) return null;
    return { pincode, label: String(value?.label ?? "").trim() };
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
    safeSetItem(STORAGE_KEY, JSON.stringify(next));
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
): DeliveryLookup | null {
  const pincode = normalizePincode(entered);
  if (!pincode) return null;

  const match = findDeliveryZone(zones, { pincode });
  if (!match) return { served: false, zoneName: "", minDeliveryDays: null, charge: null };

  const { zone } = match;
  return {
    served: true,
    zoneName: zone.name?.trim() ?? "",
    /*
      Read straight off the zone, and `Number.isFinite` rather than a truthy
      check: 0 IS a value here — it is same-day — and a truthy test would
      silently drop the fastest zone a shop can configure.
    */
    minDeliveryDays: Number.isFinite(zone.minDeliveryDays) ? zone.minDeliveryDays : null,
    charge: Number.isFinite(zone.deliveryCharge) ? zone.deliveryCharge : null,
  };
}

/**
 * The button's own line.
 *
 * The zone's name when there is one, the pincode when the shop left the zone
 * unnamed, and nothing at all before a choice is made — the caller renders its
 * own prompt then, rather than this module inventing one.
 */
export function deliveryLocationLabel(location: DeliveryLocation | null): string {
  if (!location) return "";
  return location.label || location.pincode;
}
