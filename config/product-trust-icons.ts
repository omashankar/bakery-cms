import {
  BadgeCheck,
  Clock,
  CreditCard,
  Gift,
  Heart,
  Leaf,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a shop can put on a product-page trust card.
 *
 * A FIXED LIST rather than free text, because the stored value is a name and the
 * renderer has to turn it back into a component — a Lucide icon cannot be
 * stored, cannot cross an API boundary, and a typo would render nothing at all.
 * The same reason `BusinessLabels.productIcon` is not configurable.
 *
 * Deliberately small and deliberately not a bakery: a delivery van, a clock, a
 * tick, a card, a gift, a heart, a leaf, a sparkle. Between them they cover the
 * three the reference storefront shows — purchase protection, service, timely
 * delivery — without naming a trade.
 *
 * Shared by the admin picker and the product page so the two cannot disagree
 * about which names are real.
 */
export const PRODUCT_TRUST_ICONS: Record<string, LucideIcon> = {
  Truck,
  Clock,
  BadgeCheck,
  CreditCard,
  Gift,
  Heart,
  Leaf,
  Sparkles,
};

/** What an admin sees beside each icon in the picker. */
export const PRODUCT_TRUST_ICON_LABELS: Record<keyof typeof PRODUCT_TRUST_ICONS, string> = {
  Truck: "Delivery van",
  Clock: "Clock",
  BadgeCheck: "Tick",
  CreditCard: "Card",
  Gift: "Gift",
  Heart: "Heart",
  Leaf: "Leaf",
  Sparkles: "Sparkle",
};

/**
 * The icon for a stored name, or the fallback.
 *
 * Never undefined: a settings document written before a name was removed from
 * the list above would otherwise render `<undefined />`, which React throws on.
 */
export function productTrustIcon(name: string): LucideIcon {
  return PRODUCT_TRUST_ICONS[name] ?? BadgeCheck;
}
