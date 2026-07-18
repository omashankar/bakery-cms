import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { computeTaxAmount } from "@/features/commerce/lib/tax-utils";
import { calculateDeliveryQuote } from "@/features/orders/lib/delivery-pricing";
import type { CartLineItem } from "@/features/cart/lib/cart";

export interface CartTotalsInput {
  items: CartLineItem[];
  discount?: number;
  giftWrap?: boolean;
  deliveryAddress?: {
    city?: string;
    pincode?: string;
  };
  commerceOverride?: import("@/types/settings").CommerceSettings;
}

export interface CartTotals {
  subtotal: number;
  delivery: number;
  tax: number;
  discount: number;
  platformCharge: number;
  giftWrapFee: number;
  taxableAmount?: number;
  total: number;
  itemCount: number;
  deliveryZoneName?: string;
  estimatedDeliveryDays?: number;
}

function getCommerceConfig() {
  if (typeof window === "undefined") return defaultCommerceSettings;
  return getCommerceSettings();
}

/** @deprecated Use getCommerceSettings().freeDeliveryThreshold */
export const FREE_DELIVERY_THRESHOLD = defaultCommerceSettings.freeDeliveryThreshold;

export function getFreeDeliveryThreshold(): number {
  return getCommerceConfig().freeDeliveryThreshold;
}

export function calculateCartTotals({
  items,
  discount = 0,
  giftWrap = false,
  deliveryAddress,
  commerceOverride,
}: CartTotalsInput): CartTotals {
  const commerce = commerceOverride ?? getCommerceConfig();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const giftWrapFee =
    giftWrap && commerce.giftWrapEnabled && items.length > 0 ? commerce.giftWrapFee : 0;
  const deliveryQuote =
    items.length === 0
      ? { delivery: 0, usedZonePricing: false }
      : calculateDeliveryQuote(
          {
            subtotal,
            city: deliveryAddress?.city,
            pincode: deliveryAddress?.pincode,
          },
          commerce
        );
  const delivery = deliveryQuote.delivery;
  const { taxableAmount, tax, platformCharge } = computeTaxAmount(commerce, {
    subtotal,
    discount,
    delivery,
  });
  const total = Math.max(subtotal - discount + delivery + tax + platformCharge + giftWrapFee, 0);

  return {
    subtotal,
    delivery,
    tax,
    discount,
    platformCharge,
    giftWrapFee,
    taxableAmount,
    total,
    itemCount,
    deliveryZoneName: deliveryQuote.zoneName,
    estimatedDeliveryDays: deliveryQuote.estimatedDeliveryDays,
  };
}
