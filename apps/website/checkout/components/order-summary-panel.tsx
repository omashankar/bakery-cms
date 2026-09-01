import Link from "next/link";
import { cartLineChoices, type CartLineItem } from "@/features/cart/lib/cart";
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
  /**
   * This panel is describing an order that has already been placed.
   *
   * The order page reuses it, where the free-delivery nudge is advice nobody
   * can act on — the basket is closed and the delivery was charged at whatever
   * it was charged. Worse on a DELIVERED order: it reads as a live offer.
   */
  placed?: boolean;
  /** Settled refunds, so a partially refunded order does not read as fully paid. */
  refunded?: number;
}

function getCommerceLabels() {
  if (typeof window === "undefined") {
    return {
      taxLabel: defaultCommerceSettings.taxLabel,
      platformChargeLabel: defaultCommerceSettings.platformChargeLabel,
      giftWrapLabel: defaultCommerceSettings.giftWrapLabel,
      taxRate: defaultCommerceSettings.taxRate,
    };
  }
  const commerce = getCommerceSettings();
  return {
    taxLabel: commerce.taxLabel,
    platformChargeLabel: commerce.platformChargeLabel,
    giftWrapLabel: commerce.giftWrapLabel,
    // Checked against the rate the ORDER stored, so a rate change cannot
    // restate the tax line on an order already placed.
    taxRate: commerce.taxRate,
  };
}

export function OrderSummaryPanel({
  items,
  totals,
  className,
  showEditLink = true,
  discountLabel,
  giftWrapLabel,
  placed = false,
  refunded = 0,
}: OrderSummaryPanelProps) {
  const freeDeliveryThreshold = getFreeDeliveryThreshold();
  const labels = getCommerceLabels();
  const breakdown = taxBreakdownFromCartTotals(totals, {
    taxLabel: labels.taxLabel,
    platformChargeLabel: labels.platformChargeLabel,
    giftWrapLabel: giftWrapLabel ?? labels.giftWrapLabel,
    discountLabel,
    currentTaxRate: labels.taxRate,
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
              {/*
                One component, three places: the checkout review step, the cart
                sidebar, and the customer's own placed-order and tracking page,
                which has no other item markup at all. It showed weight and
                flavour only — no shape, and none of the shop's own option
                groups — so the last screen before paying, and the only one after,
                both omitted what the customer had chosen.
              */}
              {cartLineChoices(item).length > 0 ? (
                <p className="truncate text-xs text-muted-foreground">
                  {cartLineChoices(item).join(" · ")}
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

      {refunded && refunded > 0 ? (
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          {/*
            A partially refunded order used to show only "Total paid", the full
            amount, with no mention of the refund — while the INVOICE for the
            same order shows both. The sentence was true, but a customer reading
            this to work out what they were left charged got no answer here.
          */}
          <div className="flex justify-between text-muted-foreground">
            <span>Refunded</span>
            <span>−{formatCurrency(refunded)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Net paid</span>
            <span>{formatCurrency(Math.max(0, totals.total - refunded))}</span>
          </div>
        </div>
      ) : null}

      {!placed && totals.subtotal > 0 && totals.subtotal < freeDeliveryThreshold ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Add {formatCurrency(freeDeliveryThreshold - totals.subtotal)} more for free delivery.
        </p>
      ) : null}
    </aside>
  );
}
