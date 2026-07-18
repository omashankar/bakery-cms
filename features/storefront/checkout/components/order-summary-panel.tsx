import Link from "next/link";
import type { CartLineItem } from "@/features/cart/lib/cart";
import type { CartTotals } from "@/features/orders/lib/cart-totals";
import { getFreeDeliveryThreshold } from "@/features/orders/lib/cart-totals";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { TaxBreakdown, taxBreakdownFromCartTotals } from "@/components/shared/tax-breakdown";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface OrderSummaryPanelProps {
  items: CartLineItem[];
  totals: CartTotals;
  className?: string;
  showEditLink?: boolean;
  discountLabel?: string;
  giftWrapLabel?: string;
}

function getCommerceLabels() {
  if (typeof window === "undefined") {
    return {
      taxLabel: defaultCommerceSettings.taxLabel,
      platformChargeLabel: defaultCommerceSettings.platformChargeLabel,
      giftWrapLabel: defaultCommerceSettings.giftWrapLabel,
    };
  }
  const commerce = getCommerceSettings();
  return {
    taxLabel: commerce.taxLabel,
    platformChargeLabel: commerce.platformChargeLabel,
    giftWrapLabel: commerce.giftWrapLabel,
  };
}

export function OrderSummaryPanel({
  items,
  totals,
  className,
  showEditLink = true,
  discountLabel,
  giftWrapLabel,
}: OrderSummaryPanelProps) {
  const freeDeliveryThreshold = getFreeDeliveryThreshold();
  const labels = getCommerceLabels();
  const breakdown = taxBreakdownFromCartTotals(totals, {
    taxLabel: labels.taxLabel,
    platformChargeLabel: labels.platformChargeLabel,
    giftWrapLabel: giftWrapLabel ?? labels.giftWrapLabel,
    discountLabel,
  });

  return (
    <aside className={cn("h-fit rounded-xl border border-border bg-cream-50 p-6", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Order Summary</h2>
        {showEditLink ? (
          <Link href={routes.store.cart} className="text-xs font-medium text-bakery-700 hover:underline">
            Edit cart
          </Link>
        ) : null}
      </div>

      <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto border-b border-border pb-4">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 text-sm">
            <span className="size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {item.quantity} × {item.name}
              </p>
              {item.weight || item.flavour ? (
                <p className="truncate text-xs text-muted-foreground">
                  {[item.weight, item.flavour].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <span className="shrink-0">{formatCurrency(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <TaxBreakdown values={breakdown} />
      </div>

      {totals.deliveryZoneName ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Delivery zone: <span className="font-medium text-foreground">{totals.deliveryZoneName}</span>
          {totals.estimatedDeliveryDays
            ? ` · Estimated ${totals.estimatedDeliveryDays} day(s)`
            : ""}
        </p>
      ) : null}

      {totals.subtotal > 0 && totals.subtotal < freeDeliveryThreshold ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Add {formatCurrency(freeDeliveryThreshold - totals.subtotal)} more for free delivery.
        </p>
      ) : null}
    </aside>
  );
}
