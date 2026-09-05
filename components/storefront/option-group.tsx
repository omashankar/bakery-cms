"use client";

import { cn } from "@/lib/utils";

/**
 * A choice the customer makes. Renders nothing when there is nothing to choose.
 *
 * The label used to paint unconditionally, which was harmless only because no
 * list could be empty: `getProductWeightOptions` fell back to the shop's catalog
 * tiers and `getProductShapeOptions` to Round/Square/Heart, so the empty case
 * was dead code. Both now return `[]` for a product that declares none — which
 * is the point — and that turned the dead case into the default one: a phone
 * charger rendered a "Weight" heading over nothing and a "Shape" heading over
 * nothing, on the page a customer buys from.
 *
 * `count` is REQUIRED rather than derived from `children`, so a new group cannot
 * be added without stating how many options it has. A convention would have been
 * forgotten the same way the three above were; a required prop is a type error.
 *
 * Lives here rather than inside the product page because the product page is
 * not the only screen that offers a choice — the cart offers the same ones
 * again, and a second copy is how two screens come to disagree about what an
 * empty group looks like.
 */
export function OptionGroup({
  label,
  count,
  aside,
  children,
}: {
  label: string;
  count: number;
  /**
   * Something small beside the heading — a “Serving Info” link, a size guide.
   *
   * Optional, and rendered only when passed, so every other group keeps the
   * heading it had.
   */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (count <= 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">{label}</p>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function OptionButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2 text-sm font-medium transition-premium",
        active
          ? "border-bakery-700 bg-bakery-700 text-white"
          : "border-border bg-white hover:border-bakery-300"
      )}
    >
      {children}
    </button>
  );
}
