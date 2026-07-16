import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { formatOrderStatus } from "@/features/storefront/checkout/lib/order-status-meta";
import { TaxBreakdown, taxBreakdownFromCartTotals } from "@/components/shared/tax-breakdown";
import { SafeImage } from "@/components/shared/safe-image";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import type { InvoiceSettings } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

interface InvoiceDocumentProps {
  order: PlacedOrder;
  settings: InvoiceSettings;
  taxLabel?: string;
  platformChargeLabel?: string;
  giftWrapLabel?: string;
  variant?: "screen" | "print";
  className?: string;
}

export function InvoiceDocument({
  order,
  settings,
  taxLabel = defaultCommerceSettings.taxLabel,
  platformChargeLabel = defaultCommerceSettings.platformChargeLabel,
  giftWrapLabel = defaultCommerceSettings.giftWrapLabel,
  variant = "print",
  className,
}: InvoiceDocumentProps) {
  const breakdown = taxBreakdownFromCartTotals(order.totals, {
    taxLabel,
    platformChargeLabel,
    giftWrapLabel,
    discountLabel: order.coupon ? `Discount (${order.coupon.code})` : "Discount",
  });

  const addressLine = [
    order.address.addressLine1,
    order.address.addressLine2,
    `${order.address.city}, ${order.address.state} ${order.address.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article
      className={cn(
        // The invoice is white paper, but every text/border below uses theme tokens.
        // Without this light island they inherit html.dark and render near-white on white.
        "storefront-light",
        "mx-auto max-w-3xl bg-white text-sm text-foreground",
        variant === "screen" && "rounded-xl border border-border shadow-sm",
        variant === "print" && "invoice-print-document p-0 sm:p-0",
        variant === "screen" && "p-6 sm:p-8",
        className
      )}
    >
      <header className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {settings.showLogo && settings.logoUrl ? (
              <SafeImage
                src={settings.logoUrl}
                alt={settings.companyName}
                className="size-[72px] rounded-lg border border-border bg-cream-50 object-contain p-2"
                fill={false}
              />
            ) : null}
            <div>
              <p className="font-heading text-2xl font-bold text-bakery-900">
                {settings.companyName}
              </p>
              {settings.tagline ? (
                <p className="mt-1 text-muted-foreground">{settings.tagline}</p>
              ) : null}
              <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                <p>{settings.address}</p>
                <p>
                  {settings.email}
                  {settings.phone ? ` · ${settings.phone}` : ""}
                </p>
                {settings.website ? <p>{settings.website}</p> : null}
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {settings.invoiceTitle}
            </p>
            <p className="mt-1 text-lg font-semibold">{order.orderNumber}</p>
            <p className="text-muted-foreground">Issued {formatDate(order.placedAt)}</p>
            {settings.showOrderStatus ? (
              <p className="mt-1 text-muted-foreground">
                Status: {formatOrderStatus(order.status)}
              </p>
            ) : null}
            {settings.showGstNumber && settings.gstNumber ? (
              <p className="mt-2 text-xs text-muted-foreground">GSTIN: {settings.gstNumber}</p>
            ) : null}
            {settings.showPanNumber && settings.panNumber ? (
              <p className="text-xs text-muted-foreground">PAN: {settings.panNumber}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Bill to
          </p>
          <p className="mt-1 font-semibold">{order.address.fullName}</p>
          <p>{order.address.email}</p>
          <p>{order.address.phone}</p>
          <p className="mt-2 text-muted-foreground">{addressLine}</p>
        </div>
        {settings.showDeliveryDetails ? (
          <div>
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Delivery
            </p>
            <p className="mt-1 font-medium">
              {formatDate(order.estimatedDelivery)}
              {order.totals.deliveryZoneName ? ` · ${order.totals.deliveryZoneName}` : ""}
            </p>
            {order.orderNotes ? (
              <p className="mt-2 text-muted-foreground">Notes: {order.orderNotes}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3">Item</th>
            <th className="py-2 pr-3">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-border/60 align-top">
              <td className="py-3 pr-3">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.weight, item.shape, item.flavour].filter(Boolean).join(" · ")}
                </p>
                {item.message ? (
                  <p className="mt-1 text-xs text-muted-foreground">Message: {item.message}</p>
                ) : null}
              </td>
              <td className="py-3 pr-3">{item.quantity}</td>
              <td className="py-3 text-right">{formatCurrency(item.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TaxBreakdown values={breakdown} className="ml-auto mt-6 max-w-xs" showAllLines />

      {settings.showPaymentDetails ? (
        <div className="mt-6 rounded-lg border border-border bg-cream-50 px-4 py-3 text-xs text-muted-foreground">
          Payment: {order.paymentMethod.toUpperCase()} · {order.paymentStatus.toUpperCase()}
          {order.paymentReference ? ` · Ref ${order.paymentReference}` : ""}
          {order.refundReference ? ` · Refund ref ${order.refundReference}` : ""}
        </div>
      ) : null}

      {settings.showTerms && settings.termsAndConditions ? (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Terms & conditions
          </p>
          <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
            {settings.termsAndConditions}
          </p>
        </div>
      ) : null}

      <footer className="mt-6 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {settings.footerNote ? <p>{settings.footerNote}</p> : null}
          {settings.showDeliveryDetails ? (
            <p className="mt-2">
              Delivered to {order.address.city} {order.address.pincode}
            </p>
          ) : null}
        </div>

        {settings.showSignature ? (
          <div className="text-right">
            <div className="mb-2 h-10 border-b border-dashed border-border" />
            <p className="text-sm font-medium">{settings.signatureName}</p>
            <p className="text-xs text-muted-foreground">{settings.signatureTitle}</p>
          </div>
        ) : null}
      </footer>
    </article>
  );
}
