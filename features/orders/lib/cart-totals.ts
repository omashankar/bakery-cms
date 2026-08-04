import { getActiveLocale } from "@/features/settings/lib/active-locale";
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
  /**
   * The shop's currency, so tax rounds to that currency's minor unit.
   *
   * Omitted means rupees, which is what every caller was implicitly getting.
   */
  currencyOverride?: string;
}

export interface CartTotals {
  subtotal: number;
  delivery: number;
  tax: number;
  discount: number;
  platformCharge: number;
  giftWrapFee: number;
  taxableAmount?: number;
  /**
   * The rate and label this order's tax was computed under, frozen at placement.
   *
   * Every invoice surface read the CURRENT `commerce.taxLabel` — and the label
   * is auto-derived from the rate — so moving 5% to 18% restated the rate on
   * every invoice already issued while the stored amount stayed where it was.
   * Optional because orders placed before this existed have neither; those fall
   * back to `tax / taxableAmount`, which was always recorded.
   */
  taxRate?: number;
  taxLabel?: string;
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

/**
 * The currency the tax rounds to.
 *
 * Same split as `getCommerceConfig`, and for the same reason. `getActiveLocale`
 * is a module-level global, which is correct in a browser (one shop, set from
 * settings hydration) and wrong on the server, where one process serves every
 * request — so a server caller must say which currency it means, and
 * `pricing.server.ts` does.
 *
 * Without this the browser and the server disagreed for any shop not priced in
 * rupees: the server rounded tax to cents and the browser to whole units, so
 * the cart showed $8 against a draft that charged $8.25 — a total the customer
 * never agreed to, which is the exact class of bug the server-side pricing work
 * exists to remove.
 */
function resolveCurrency(override?: string): string | undefined {
  if (override) return override;
  return typeof window === "undefined" ? undefined : getActiveLocale().currency;
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
  currencyOverride,
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
  const { taxableAmount, tax, platformCharge, taxRate } = computeTaxAmount(commerce, {
    subtotal,
    discount,
    delivery,
    // Gift wrap is part of the supply being taxed. It used to be added to the
    // total after tax and left out of the base entirely.
    giftWrapFee,
    currency: resolveCurrency(currencyOverride),
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
    // Recorded WITH the amount, so the document can state the rate it was
    // actually charged at instead of reading back whatever the shop charges
    // today. Changing the rate used to relabel every invoice already issued.
    taxRate,
    taxLabel: commerce.taxEnabled ? commerce.taxLabel : "",
    total,
    itemCount,
    deliveryZoneName: deliveryQuote.zoneName,
    estimatedDeliveryDays: deliveryQuote.estimatedDeliveryDays,
    deliveryMinDays: deliveryQuote.minDeliveryDays,
  };
}
