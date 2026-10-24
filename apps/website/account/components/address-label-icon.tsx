import { Briefcase, Home, MapPin } from "lucide-react";

/**
 * The mark for an address's label — the three the forms offer, and a pin for
 * anything else. Shared by the account address book and the checkout, so the
 * same address wears the same icon on both.
 *
 * A component that returns the icon, not a function that returns the icon's
 * component: `const Icon = pick(label); <Icon />` creates a component during
 * render, which the React compiler refuses.
 */
export function AddressLabelIcon({ label, className }: { label: string; className?: string }) {
  if (label === "Home") return <Home className={className} aria-hidden />;
  if (label === "Office") return <Briefcase className={className} aria-hidden />;
  return <MapPin className={className} aria-hidden />;
}
