"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, Printer } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { AdminOrderStatusBadge } from "@/features/admin/commerce/components/admin-order-status-badge";
import { AdminPaymentStatusBadge } from "@/features/admin/commerce/components/admin-payment-status-badge";
import { CancelOrderDialog } from "@/features/admin/commerce/components/cancel-order-dialog";
import { OrderInvoice } from "@/features/admin/commerce/components/order-invoice";
import { RefundOrderDialog } from "@/features/admin/commerce/components/refund-order-dialog";
import { RefundTimeline } from "@/features/admin/commerce/components/refund-timeline";
import { formatRefundReason } from "@/features/admin/commerce/lib/refund-utils";
import { runBrowserPrint } from "@/features/admin/commerce/lib/print-invoice";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { OrderStatusTimeline } from "@/features/storefront/checkout/components/order-status-timeline";
import { getOrderTimeline } from "@/features/storefront/checkout/lib/order-tracking";
import { isTerminalOrderStatus } from "@/features/storefront/checkout/lib/order-status-meta";
import { getActiveFulfillmentStatuses } from "@/features/storefront/checkout/lib/order-tracking";
import {
  cancelOrder,
  getOrderById,
  refundOrder,
  updateOrderAdminNotes,
  updateOrderStatus,
  type OrderStatus,
  type PlacedOrder,
  type RefundOrderInput,
} from "@/features/storefront/checkout/lib/orders";
import { SafeImage } from "@/components/shared/safe-image";
import { TaxBreakdown, taxBreakdownFromCartTotals } from "@/components/shared/tax-breakdown";
import { getCommerceSettings } from "@/features/admin/settings/lib/settings-repository";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/utils/format";

interface OrderDetailPageProps {
  orderId: string;
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter();
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    const current = getOrderById(orderId);
    setOrder(current);
    setAdminNotes(current?.adminNotes ?? "");

    function refresh() {
      const next = getOrderById(orderId);
      setOrder(next);
      setAdminNotes(next?.adminNotes ?? "");
    }

    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, [orderId]);

  const timeline = useMemo(() => (order ? getOrderTimeline(order) : []), [order]);
  const statusOptions = getActiveFulfillmentStatuses();
  const isTerminal = order ? isTerminalOrderStatus(order.status) : false;

  function handleStatusChange(status: OrderStatus) {
    if (!order) return;
    const updated = updateOrderStatus(order.id, status);
    if (!updated) return;
    setOrder(updated);
    toast.success(`Order marked as ${status.replace(/_/g, " ")}`);
  }

  function handleSaveNotes() {
    if (!order) return;
    const updated = updateOrderAdminNotes(order.id, adminNotes);
    if (!updated) return;
    setOrder(updated);
    toast.success("Internal notes saved");
  }

  function handleCancel(reason: string) {
    if (!order) return;
    const updated = cancelOrder(order.id, reason);
    if (!updated) return;
    setOrder(updated);
    setCancelOpen(false);
    toast.success("Order cancelled");
  }

  function handleRefund(input: RefundOrderInput) {
    if (!order) return;
    const updated = refundOrder(order.id, input);
    if (!updated) return;
    setOrder(updated);
    toast.success("Refund recorded", {
      description: updated.refundReference,
    });
  }

  if (!order) {
    return (
      <AdminPage className="space-y-4 sm:space-y-5">
        <AdminPageHeader
          title="Order not found"
          description="This order may have been removed or the link is invalid."
          className="gap-3"
          actions={
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              render={<Link href={routes.admin.orders.list} />}
            >
              <ArrowLeft className="size-4" />
              Back to orders
            </Button>
          }
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <OrderInvoice order={order} />

      <div className="print:hidden space-y-4 sm:space-y-5">
        <AdminPageHeader
          title={order.orderNumber}
          description={`Placed ${formatDate(order.placedAt)} · ${formatCurrency(order.totals.total)}`}
          className="gap-3"
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => runBrowserPrint()}
              >
                <Printer className="size-4" />
                Print invoice
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                render={<Link href={routes.admin.orders.list} />}
              >
                <ArrowLeft className="size-4" />
                Orders
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <AdminOrderStatusBadge status={order.status} />
          <AdminPaymentStatusBadge status={order.paymentStatus} />
          {order.cancellationReason ? (
            <span className="text-xs text-muted-foreground">
              Cancel reason: {order.cancellationReason}
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
          <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Items</h2>
            <ul className="mt-4 space-y-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.price)}
                      {item.weight ? ` · ${item.weight}` : ""}
                      {item.shape ? ` · ${item.shape}` : ""}
                    </p>
                    {item.message ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Message: {item.message}
                      </p>
                    ) : null}
                  </div>
                  <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Fulfillment timeline</h2>
            <div className="mt-4">
              <OrderStatusTimeline steps={timeline} />
            </div>
          </div>

          {order.orderNotes ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">Customer instructions</h2>
              <p className="mt-2 text-sm text-muted-foreground">{order.orderNotes}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Internal notes</h2>
            <textarea
              className={`${adminTextareaClassName} mt-3`}
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="Notes visible only to admin staff..."
              rows={4}
            />
            <Button variant="outline" size="sm" className="mt-3" onClick={handleSaveNotes}>
              Save notes
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Customer</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="font-medium">{order.address.fullName}</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" />
                {order.address.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                {order.address.phone}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                render={
                  <Link
                    href={routes.admin.customers.detail(
                      encodeURIComponent(order.address.email.trim().toLowerCase())
                    )}
                  />
                }
              >
                View customer
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Delivery</h2>
            <div className="mt-4 flex gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <div>
                <p>{order.address.addressLine1}</p>
                {order.address.addressLine2 ? <p>{order.address.addressLine2}</p> : null}
                <p>
                  {order.address.city}, {order.address.state} {order.address.pincode}
                </p>
                <p className="mt-2">Est. delivery: {formatDate(order.estimatedDelivery)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Payment</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="uppercase">{order.paymentMethod}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <AdminPaymentStatusBadge status={order.paymentStatus} />
                </dd>
              </div>
              {order.paymentReference ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="text-right">{order.paymentReference}</dd>
                </div>
              ) : null}
              {order.refundReference ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Refund ref</dt>
                  <dd className="text-right">{order.refundReference}</dd>
                </div>
              ) : null}
              {order.refundRecord ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Refund reason</dt>
                  <dd className="text-right">{formatRefundReason(order.refundRecord.reason)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {order.refundRecord?.history.length ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">Refund timeline</h2>
              <div className="mt-4">
                <RefundTimeline events={order.refundRecord.history} />
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Summary</h2>
            <div className="mt-4">
              <TaxBreakdown
                values={taxBreakdownFromCartTotals(order.totals, {
                  taxLabel: getCommerceSettings().taxLabel,
                  platformChargeLabel: getCommerceSettings().platformChargeLabel,
                  discountLabel: order.coupon ? `Discount (${order.coupon.code})` : "Discount",
                })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Label htmlFor="order-status">Update status</Label>
            <AdminSelect
              id="order-status"
              className="mt-2"
              value={order.status}
              disabled={isTerminal}
              onChange={(event) => handleStatusChange(event.target.value as OrderStatus)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </AdminSelect>

            <div className="mt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  router.push(routes.store.orderDetail(order.orderNumber))
                }
              >
                View customer tracking
              </Button>
              {!isTerminal ? (
                <>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel order
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setRefundOpen(true)}
                  >
                    Issue refund
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <CancelOrderDialog
        open={cancelOpen}
        orderNumber={order.orderNumber}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancel}
      />
      <RefundOrderDialog
        open={refundOpen}
        orderNumber={order.orderNumber}
        totalLabel={formatCurrency(order.totals.total)}
        onOpenChange={setRefundOpen}
        onConfirm={handleRefund}
      />
      </div>
    </AdminPage>
  );
}
