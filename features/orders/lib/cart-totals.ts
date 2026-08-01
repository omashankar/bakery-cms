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
  /** Delivery zones from the caller — the server passes its own; see below. */
  zonesOverride?: import("@/types/delivery").DeliveryZone[];
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
  /**
   * The zone's minimum lead time, carried so the checkout and the server can
   * both refuse a date the shop cannot bake for.
   *
   * The quote produced it and this dropped it, so a zone configured for five
   * days accepted tomorrow: the date picker floors on the shop-wide
   * `deliveryLeadDays` and nothing anywhere consulted the zone.
   */
  deliveryMinDays?: number;
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
  // Was declared on the input type and never taken out of it.
  //
  // `pricing.server.ts` has been passing the shop's Mongo zones in here since
  // the server took over pricing, and every one of them was dropped on the
  // floor: the third argument to `calculateDeliveryQuote` was simply never
  // supplied, so the server fell through to `loadDeliveryZones()`, which
  // returns the hardcoded DEMO zones when there is no `window`. The
  // authoritative price — the one Razorpay is asked for — was computed against
  // Mumbai/Pune sample data no matter what the shop had configured.
  //
  // It stayed invisible because `listZones()` seeds Mongo from the same demo
  // rows when the collection is empty, so an untouched install agrees with
  // itself. The prices only diverge once an admin edits a zone, which is to say
  // the moment the feature is used for real.
  zonesOverride,
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
          commerce,
          zonesOverride
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
    deliveryMinDays: deliveryQuote.minDeliveryDays,
  };
}
