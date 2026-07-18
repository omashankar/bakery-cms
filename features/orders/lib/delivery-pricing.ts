import type { CommerceSettings } from "@/types/settings";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { resolveDeliveryZoneForAddress } from "@/features/commerce/lib/delivery-zones-repository";

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
  commerceOverride?: CommerceSettings
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

  const match = resolveDeliveryZoneForAddress({
    city: input.city,
    pincode: input.pincode,
  });

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
