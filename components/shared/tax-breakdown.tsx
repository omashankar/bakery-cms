import type { CartTotals } from "@/features/storefront/checkout/lib/cart-totals";
import type { TaxBreakdownValues } from "@/types/tax-breakdown";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

export interface TaxBreakdownProps {
  values: TaxBreakdownValues;
  size?: "sm" | "md";
  className?: string;
  showFreeDelivery?: boolean;
  showAllLines?: boolean;
  showTaxableAmount?: boolean;
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "discount" | "muted";
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        strong && "border-t border-border pt-2 text-base font-semibold",
        tone === "discount" && "text-green-700",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      <dt className={tone === "muted" ? "text-muted-foreground" : undefined}>{label}</dt>
      <dd className="shrink-0 text-right">{value}</dd>
    </div>
  );
}

export function TaxBreakdown({
  values,
  size = "sm",
  className,
  showFreeDelivery = true,
  showAllLines = false,
  showTaxableAmount = false,
}: TaxBreakdownProps) {
  const textClass = size === "sm" ? "text-sm" : "text-base";
  const showTax = showAllLines || values.tax > 0;
  const showPlatform =
    showAllLines || (values.platformCharge !== undefined && values.platformCharge > 0);
  const showGiftWrap =
    showAllLines || (values.giftWrapFee !== undefined && values.giftWrapFee > 0);

  return (
    <dl className={cn("space-y-2", textClass, className)}>
      <Row label="Subtotal" value={formatCurrency(values.subtotal)} tone="muted" />
      {values.discount && values.discount > 0 ? (
        <Row
          label={values.discountLabel ?? "Discount"}
          value={`-${formatCurrency(values.discount)}`}
          tone="discount"
        />
      ) : null}
      {showTaxableAmount && values.taxableAmount !== undefined ? (
        <Row
          label="Taxable amount"
          value={formatCurrency(values.taxableAmount)}
          tone="muted"
        />
      ) : null}
      <Row
        label="Delivery"
        value={
          showFreeDelivery && values.delivery === 0
            ? "Free"
            : formatCurrency(values.delivery)
        }
        tone="muted"
      />
      {showTax ? (
        <Row
          label={values.taxLabel ?? "Tax"}
          value={formatCurrency(values.tax)}
          tone="muted"
        />
      ) : null}
      {showPlatform ? (
        <Row
          label={values.platformChargeLabel ?? "Platform fee"}
          value={formatCurrency(values.platformCharge ?? 0)}
          tone="muted"
        />
      ) : null}
      {showGiftWrap ? (
        <Row
          label={values.giftWrapLabel ?? "Gift wrap"}
          value={formatCurrency(values.giftWrapFee ?? 0)}
          tone="muted"
        />
      ) : null}
      <Row label="Total" value={formatCurrency(values.total)} strong />
    </dl>
  );
}

export function taxBreakdownFromCartTotals(
  totals: CartTotals,
  options?: {
    taxLabel?: string;
    platformChargeLabel?: string;
    giftWrapLabel?: string;
    discountLabel?: string;
  }
): TaxBreakdownValues {
  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    discountLabel: options?.discountLabel,
    delivery: totals.delivery,
    tax: totals.tax,
    taxLabel: options?.taxLabel,
    platformCharge: totals.platformCharge ?? 0,
    platformChargeLabel: options?.platformChargeLabel,
    giftWrapFee: totals.giftWrapFee ?? 0,
    giftWrapLabel: options?.giftWrapLabel,
    taxableAmount: totals.taxableAmount,
    total: totals.total,
  };
}
