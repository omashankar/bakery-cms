import {
  Clock,
  Flame,
  Gift,
  Sparkles,
  Tag,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a header nav row may carry, BY NAME.
 *
 * A name rather than a component, because this value crosses the wire from
 * MongoDB and is typed by an admin.
 *
 * Kept small on purpose: a picker of four hundred lucide icons is a worse
 * control than six that mean something in a header. Every one is generic enough
 * for any trade — a van, a clock, a gift, a spark, a flame, a tag. None of them
 * names goods, which is the rule this whole project is built on.
 *
 * It lives in `config/` beside `product-trust-icons` rather than in the navbar
 * because the ADMIN needs the same list to offer it, and `apps/admin` may not
 * import from `apps/website`. One list, or the picker and the render drift and
 * a shop picks an icon that does not appear.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  Truck,
  Clock,
  Gift,
  Sparkles,
  Flame,
  Tag,
};

/**
 * The component for a stored name, or null.
 *
 * NEVER throws. This renders in the header of every storefront page, outside
 * the try/catch that guards the chrome read — an unknown name must be no icon,
 * not a blank site.
 */
export function navIcon(name?: string): LucideIcon | null {
  if (!name) return null;
  return NAV_ICONS[name] ?? null;
}
