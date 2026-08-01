import type { CommerceSettings } from "@/types/settings";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  findDeliveryZone,
  resolveDeliveryZoneForAddress,
} from "@/features/commerce/lib/delivery-zones-repository";
import type { DeliveryZone } from "@/types/delivery";

export interface DeliveryQuote {
  delivery: number;
  zoneName?: string;
  zoneId?: string;
  minDeliveryDays?: number;
  estimatedDeliveryDays?: number;
  usedZonePricing: boolean;
}

export function calculateDeliveryQuote(
  input: {
    subtotal: number;
    city?: string;
    pincode?: string;
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
    };
  }

  const match = zonesOverride
    ? findDeliveryZone(zonesOverride, { city: input.city, pincode: input.pincode })
    : resolveDeliveryZoneForAddress({ city: input.city, pincode: input.pincode });

  // Free delivery no longer short-circuits the lookup.
  //
  // It used to return before any zone was resolved, so an order over the
  // threshold lost its zone name and its delivery estimate entirely — the
  // customer saw no zone and no lead time on the very orders the shop most wants
  // to look confident about, and the stored order carried neither.
  const free = input.subtotal >= commerce.freeDeliveryThreshold;

  if (!match) {
    return {
      // `??`, not `||`. A shop that deliberately sets a ZERO fallback — deliver
      // anywhere unmatched at no charge — got the standard fee instead, because
      // 0 is falsy. The two settings mean opposite things and one silently
      // became the other.
      delivery: free ? 0 : (commerce.zoneFallbackDeliveryFee ?? commerce.deliveryFee),
      usedZonePricing: true,
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
  };
}
