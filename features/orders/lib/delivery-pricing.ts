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

  if (input.subtotal >= commerce.freeDeliveryThreshold) {
    return { delivery: 0, usedZonePricing: commerce.useZoneBasedDelivery };
  }

  if (!commerce.useZoneBasedDelivery) {
    return {
      delivery: commerce.deliveryFee,
      usedZonePricing: false,
    };
  }

  const match = zonesOverride
    ? findDeliveryZone(zonesOverride, { city: input.city, pincode: input.pincode })
    : resolveDeliveryZoneForAddress({ city: input.city, pincode: input.pincode });

  if (!match) {
    return {
      delivery: commerce.zoneFallbackDeliveryFee || commerce.deliveryFee,
      usedZonePricing: true,
    };
  }

  return {
    delivery: match.zone.deliveryCharge,
    zoneName: match.zone.name,
    zoneId: match.zone.id,
    minDeliveryDays: match.zone.minDeliveryDays,
    estimatedDeliveryDays: match.zone.estimatedDeliveryDays,
    usedZonePricing: true,
  };
}
