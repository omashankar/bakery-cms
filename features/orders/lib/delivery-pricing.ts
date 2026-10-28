import type { CommerceSettings } from "@/types/settings";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { loadDeliveryZones } from "@/features/commerce/lib/delivery-zones-repository";
import { findDeliveryZoneForPin, findRegionZone, isValidLatLng, type PinRegion } from "@/features/commerce/lib/delivery-area";
import type { ZoneAddress } from "@/features/commerce/lib/delivery-zone-utils";
import type { DeliveryZone, LatLng } from "@/types/delivery";

export interface DeliveryQuote {
  delivery: number;
  zoneName?: string;
  zoneId?: string;
  minDeliveryDays?: number;
  estimatedDeliveryDays?: number;
  usedZonePricing: boolean;
  /**
   * False only when the shop takes orders inside its zones alone
   * (`deliverOutsideZones: false`) and this address is in none of them.
   * An address not entered yet is never undeliverable — there is nothing to
   * refuse until there is somewhere to deliver to.
   */
  deliverable: boolean;
}

export function calculateDeliveryQuote(
  input: {
    subtotal: number;
    city?: string;
    pincode?: string;
    state?: string;
    /** What India Post says is at the PIN — see `ZoneAddress`. */
    place?: ZoneAddress["place"];
    /** The customer's pin on the map. The ONLY thing that picks a zone. */
    location?: LatLng;
    /** The pin's district and state, for whole-district and whole-state zones. */
    region?: PinRegion | null;
  },
  commerceOverride?: CommerceSettings,
  /**
   * Zones from the caller instead of `localStorage`. The server has to pass its
   * own — without this the zone lookup silently found nothing on the server and
   * every delivery fell back to the flat fee, which is a different number from
   * the one the customer was shown.
   */
  zonesOverride?: DeliveryZone[],
): DeliveryQuote {
  const commerce = commerceOverride ?? (
    typeof window === "undefined" ? defaultCommerceSettings : getCommerceSettings()
  );

  if (!commerce.useZoneBasedDelivery) {
    return {
      delivery: input.subtotal >= commerce.freeDeliveryThreshold ? 0 : commerce.deliveryFee,
      usedZonePricing: false,
      deliverable: true,
    };
  }

  // WHERE THE PIN IS, not what PIN was typed (owner, 2026-10-27). A Kota
  // address with Sangod's PIN was priced as Sangod and taken; only an area
  // drawn on the map that holds the customer's pin decides now. PIN, city and
  // state zones match nothing here — see `DeliveryZoneCoverage`.
  const location = isValidLatLng(input.location) ? input.location : null;
  const zones = zonesOverride ?? loadDeliveryZones();
  // No pin yet (the cart, a running total): a whole district or state the PIN
  // is in still prices it — it priced nothing, and the cart showed the
  // fallback fee for a PIN the product page had just quoted at the
  // district's charge (zone review, 2026-10-28).
  const match = location
    ? findDeliveryZoneForPin(zones, location, input.region)
    : input.region
      ? findRegionZone(zones, input.region)
      : null;

  // Free delivery no longer short-circuits the lookup.
  //
  // It used to return before any zone was resolved, so an order over the
  // threshold lost its zone name and its delivery estimate entirely — the
  // customer saw no zone and no lead time on the very orders the shop most wants
  // to look confident about, and the stored order carried neither.
  const free = input.subtotal >= commerce.freeDeliveryThreshold;

  if (!match) {
    // Only a pin is somewhere to refuse. Before it is dropped — the running
    // total, the cart — there is nothing to judge yet; the server will not
    // take the order without one (see `priceCart`).
    if (location && commerce.deliverOutsideZones === false) {
      return { delivery: 0, usedZonePricing: true, deliverable: false };
    }
    return {
      // `??`, not `||`. A shop that deliberately sets a ZERO fallback — deliver
      // anywhere unmatched at no charge — got the standard fee instead, because
      // 0 is falsy. The two settings mean opposite things and one silently
      // became the other.
      delivery: free ? 0 : (commerce.zoneFallbackDeliveryFee ?? commerce.deliveryFee),
      usedZonePricing: true,
      deliverable: true,
    };
  }

  return {
    // The zone is still reported when delivery is free, so the customer keeps
    // its name and its lead time.
    delivery: free ? 0 : match.zone.deliveryCharge,
    zoneName: match.zone.name,
    zoneId: match.zone.id,
    minDeliveryDays: match.zone.minDeliveryDays,
    estimatedDeliveryDays: match.zone.estimatedDeliveryDays,
    usedZonePricing: true,
    deliverable: true,
  };
}
