"use client";

import type { PlacedOrder } from "@/features/orders/lib/orders";
import { deriveTransactionStatus, isCollectedMoney } from "@/features/payments/lib/payment-status";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import { PaymentStatusBadge } from "@/features/payments/components/payment-status-badge";
import { GatewayLogo } from "@/features/payments/components/gateway-logo";
import { getGatewayConfig } from "@/features/payments/registry/gateways";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/utils/format";

interface TransactionDetailDialogProps {
  order: PlacedOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METHOD_GATEWAY: Record<string, string> = {
  cod: "cod",
  razorpay: "razorpay",
  upi: "razorpay",
  card: "razorpay",
};

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

export function TransactionDetailDialog({ order, open, onOpenChange }: TransactionDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">
                Transaction {order.paymentReference || `TXN-${order.orderNumber}`}
              </DialogTitle>
            </DialogHeader>

            {(() => {
              const gatewayId = METHOD_GATEWAY[order.paymentMethod] ?? "razorpay";
              const gateway = getGatewayConfig(gatewayId);
              const t = order.totals;
              // The same two facts the Volume card is built from.
              const refunded = settledRefundAmount(order);
              const collected = isCollectedMoney(order) ? Math.max(0, t.total - refunded) : 0;
              const updatedAt =
                order.statusHistory?.[order.statusHistory.length - 1]?.at ?? order.placedAt;
              return (
                <div className="space-y-5 text-sm">
                  {/* Status + gateway */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted p-4">
                    <div className="flex items-center gap-3">
                      <GatewayLogo mark={gateway?.mark ?? "?"} size="md" />
                      <div>
                        <p className="font-semibold text-foreground">{gateway?.name ?? gatewayId}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {order.paymentMethod} payment
                        </p>
                      </div>
                    </div>
                    <PaymentStatusBadge status={deriveTransactionStatus(order)} />
                  </div>

                  {/* Amount breakdown */}
                  <div className="space-y-2 rounded-xl border border-border p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Amount breakdown
                    </p>
                    <Row label="Subtotal" value={formatCurrency(t.subtotal)} />
                    {t.discount > 0 ? (
                      <Row label="Discount" value={`− ${formatCurrency(t.discount)}`} />
                    ) : null}
                    {t.tax > 0 ? <Row label="Tax (GST)" value={formatCurrency(t.tax)} /> : null}
                    <Row label="Delivery" value={t.delivery === 0 ? "Free" : formatCurrency(t.delivery)} />
                    {t.giftWrapFee > 0 ? (
                      <Row label="Gift wrap" value={formatCurrency(t.giftWrapFee)} />
                    ) : null}
                    {/*
                      "Total paid" was printed for every transaction, including
                      the ones that were never paid — a failed or pending
                      payment showed its order total under a label asserting the
                      money had arrived — and it ignored refunds entirely, so a
                      fully refunded order still read as paid in full.

                      The order total is a fact about the order; what the shop
                      COLLECTED is a different number, and it is computed with
                      the same predicate the Volume card above the table uses,
                      so the dialog and that card cannot disagree about one
                      order.
                    */}
                    <div className="mt-2 border-t border-border pt-2">
                      <Row label="Order total" value={formatCurrency(t.total)} strong />
                      {refunded > 0 ? (
                        <Row label="Refunded" value={`− ${formatCurrency(refunded)}`} />
                      ) : null}
                      <Row label="Collected" value={formatCurrency(collected)} strong />
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="space-y-2 rounded-xl border border-border p-4">
                    <Row label="Order" value={order.orderNumber} />
                    <Row label="Reference" value={order.paymentReference ?? "—"} />
                    <Row label="Customer" value={order.address?.fullName ?? "—"} />
                    <Row label="Email" value={order.address?.email ?? "—"} />
                    <Row label="Created" value={formatDate(order.placedAt)} />
                    <Row label="Updated" value={formatDate(updatedAt)} />
                  </div>
                </div>
              );
            })()}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
