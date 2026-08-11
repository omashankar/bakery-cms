"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Image as ImageIcon, Loader2, Mail, MapPin, Phone, Printer } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Input } from "@/components/ui/input";
import { AdminOrderStatusBadge } from "@/apps/admin/commerce/components/admin-order-status-badge";
import { AdminPaymentStatusBadge } from "@/apps/admin/commerce/components/admin-payment-status-badge";
import { CancelOrderDialog } from "@/apps/admin/commerce/components/cancel-order-dialog";
import { OrderInvoice } from "@/apps/admin/commerce/components/order-invoice";
import { RefundOrderDialog } from "@/apps/admin/commerce/components/refund-order-dialog";
import { RefundTimeline } from "@/apps/admin/commerce/components/refund-timeline";
import { formatRefundReason } from "@/apps/admin/commerce/lib/refund-utils";
import { runBrowserPrint } from "@/features/commerce/lib/print-invoice";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { OrderStatusTimeline } from "@/components/shared/order-status-timeline";
import { getOrderTimeline } from "@/features/orders/lib/order-tracking";
import { isTerminalOrderStatus } from "@/features/orders/lib/order-status-meta";
import { getActiveFulfillmentStatuses } from "@/features/orders/lib/order-tracking";
import {
  cancelOrder,
  getOrderById,
  refundOrder,
  updateOrderAdminNotes,
  updateOrderDeliveryPartner,
  updateOrderStatus,
  type OrderStatus,
  type PlacedOrder,
  type RefundOrderInput,
} from "@/features/orders/lib/orders";
import { fetchOrder } from "@/features/orders/lib/orders-api";
import { SafeImage } from "@/components/shared/safe-image";
import { TaxBreakdown, taxBreakdownFromCartTotals } from "@/components/shared/tax-breakdown";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/utils/format";

interface OrderDetailPageProps {
  orderId: string;
}

/** The rider on an order, in the shape the form holds. */
function toPartnerForm(order: { deliveryPartner?: { name: string; phone?: string; vehicle?: string } }) {
  return {
    name: order.deliveryPartner?.name ?? "",
    phone: order.deliveryPartner?.phone ?? "",
    vehicle: order.deliveryPartner?.vehicle ?? "",
  };
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter();
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [partner, setPartner] = useState({ name: "", phone: "", vehicle: "" });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The cache is a starting point, never the answer.
    //
    // This returned as soon as localStorage had the order, and that cache holds
    // only the most recent page of orders written by whatever this browser last
    // did. So an order refunded on another device, settled by a webhook, or
    // cancelled by a colleague rendered here in its old state for the whole
    // visit — on the one screen an operator opens to find out what happened to
    // it. The server is asked every time; the cached copy only fills the gap
    // while the request is in flight, so the page does not flash empty.
    const current = getOrderById(orderId);
    if (current) {
      setOrder(current);
      setAdminNotes(current.adminNotes ?? "");
      setPartner(toPartnerForm(current));
    }

    // `fetchOrder` resolves null on any failure, so it cannot reject.
    void fetchOrder(orderId).then((fetched) => {
      if (cancelled) return;
      if (fetched) {
        setOrder(fetched);
        setAdminNotes(fetched.adminNotes ?? "");
        setPartner(toPartnerForm(fetched));
      }
      setLoading(false);
    });

    // After any write, take the SERVER's version.
    //
    // This re-read the local cache, which is where the optimistic copy of the
    // write that just happened lives. So after a refund the screen kept showing
    // the record the client had composed — including one the server had refused
    // and the write path had already rolled back — instead of what the order
    // actually holds. The cached read stays as the immediate paint; the fetch
    // corrects it.
    function refresh() {
      const next = getOrderById(orderId);
      if (next) {
        setOrder(next);
        setAdminNotes(next.adminNotes ?? "");
        setPartner(toPartnerForm(next));
      }

      void fetchOrder(orderId).then((fetched) => {
        if (cancelled || !fetched) return;
        setOrder(fetched);
        setAdminNotes(fetched.adminNotes ?? "");
        setPartner(toPartnerForm(fetched));
      });
    }

    window.addEventListener("bakery-orders-updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("bakery-orders-updated", refresh);
    };
  }, [orderId]);

  const timeline = useMemo(() => (order ? getOrderTimeline(order) : []), [order]);
  const statusOptions = getActiveFulfillmentStatuses();
  const isTerminal = order ? isTerminalOrderStatus(order.status) : false;

  /**
   * The local write always succeeds; the server write is what makes a change
   * real. Reporting only the former would tell the admin an order was cancelled
   * or refunded when the next hydration is about to undo it.
   */
  /** The order was not cached and the server read failed — never say nothing. */
  function reportUnreachable() {
    toast.error("Could not load that order", {
      description: "The server did not answer — reload and try again.",
    });
  }

  function reportUnpersisted(what: string) {
    toast.error(`${what} on this device only — the server rejected the change.`, {
      description: "Reload to see the server's version.",
    });
  }

  async function handleStatusChange(status: OrderStatus) {
    if (!order) return;
    const { order: updated, persisted } = await updateOrderStatus(order.id, status);
    if (!updated) return reportUnreachable();
    setOrder(updated);
    if (!persisted) return reportUnpersisted("Status changed");
    toast.success(`Order marked as ${status.replace(/_/g, " ")}`);
  }

  async function handleSaveNotes() {
    if (!order) return;
    const { order: updated, persisted } = await updateOrderAdminNotes(order.id, adminNotes);
    if (!updated) return reportUnreachable();
    setOrder(updated);
    if (!persisted) return reportUnpersisted("Notes saved");
    toast.success("Internal notes saved");
  }

  async function handleSavePartner() {
    if (!order) return;
    const { order: updated, persisted } = await updateOrderDeliveryPartner(order.id, partner);
    if (!updated) return reportUnreachable();
    setOrder(updated);
    if (!persisted) return reportUnpersisted("Delivery partner saved");
    toast.success(partner.name.trim() ? "Delivery partner assigned" : "Delivery partner cleared");
  }

  async function handleCancel(reason: string) {
    if (!order) return;
    const { order: updated, persisted } = await cancelOrder(order.id, reason);
    if (!updated) return reportUnreachable();
    setOrder(updated);
    setCancelOpen(false);
    if (!persisted) return reportUnpersisted("Order cancelled");
    toast.success("Order cancelled");
  }

  async function handleRefund(input: RefundOrderInput) {
    if (!order) return;
    const { order: updated, persisted, error } = await refundOrder(order.id, input);
    if (!updated) return reportUnreachable();
    setOrder(updated);

    if (!persisted) {
      // The server's reason, not a generic one.
      //
      // This called `reportUnpersisted("Refund recorded")`, which toasts
      // "Refund recorded on this device only — the server rejected the change.
      // Reload to see the server's version." Both halves were wrong: the write
      // path ROLLS BACK on refusal, so nothing was recorded anywhere, and the
      // server's actual explanation — nothing left to refund, the payment was
      // never captured, the gateway is down and this is worth retrying — was
      // thrown away. An admin read "recorded", closed the ticket, and no refund
      // was ever made. The Refund Centre was fixed for exactly this; this screen
      // was not.
      toast.error(error ?? "The refund was not accepted.");
      return;
    }

    toast.success("Refund sent to the gateway", {
      description:
        updated.refundReference ??
        "It usually settles in a few days. This screen updates when the gateway confirms.",
    });
  }

  if (loading) {
    return (
      <AdminPage className="space-y-4 sm:space-y-5">
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AdminPage>
    );
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
                    {/*
                      The photo to print.

                      The storefront's upload used to keep only the file NAME,
                      in the customer's browser, so this order arrived with a
                      photo-cake surcharge on it and nothing to print. Opened in
                      a new tab rather than shown inline: the baker needs it at
                      full size, and an <img> here would slow a list of orders
                      down for a photo most of them do not have.
                    */}
                    {item.photoUrl ? (
                      <a
                        href={item.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-bakery-700 hover:underline"
                      >
                        <ImageIcon className="size-3.5" />
                        Customer photo
                      </a>
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

          {/*
            Who is taking it out.

            The customer's tracking page showed a delivery partner on every
            order — a name, a phone number they could ring, and a star rating —
            invented by hashing the order id against three hardcoded people. It
            now shows nobody until this is filled in, so this card is the only
            thing that can put a courier in front of a customer.
          */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Delivery partner</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shown to the customer on their tracking page. Leave the name blank to remove it.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Name</span>
                <Input
                  value={partner.name}
                  onChange={(event) => setPartner((p) => ({ ...p, name: event.target.value }))}
                  placeholder="Who is delivering"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Phone</span>
                <Input
                  value={partner.phone}
                  onChange={(event) => setPartner((p) => ({ ...p, phone: event.target.value }))}
                  placeholder="Optional"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Vehicle</span>
                <Input
                  value={partner.vehicle}
                  onChange={(event) => setPartner((p) => ({ ...p, vehicle: event.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleSavePartner}>
              {partner.name.trim() ? "Save delivery partner" : "Clear delivery partner"}
            </Button>
          </div>

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
                  currentTaxRate: getCommerceSettings().taxRate,
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
        // Without this the dialog has no ceiling to validate a partial refund
        // against, so it accepts any amount and the refusal comes from the
        // gateway after the operator has typed it. The Refund Centre passed it;
        // this screen did not.
        orderTotal={order.totals.total}
        onOpenChange={setRefundOpen}
        onConfirm={handleRefund}
      />
      </div>
    </AdminPage>
  );
}
