"use client";

import { toast } from "sonner";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Package, RefreshCw } from "lucide-react";
import { DeliveryEstimatedCard } from "@/apps/website/checkout/components/delivery-estimated-card";
import { DeliveryMapPlaceholder } from "@/apps/website/checkout/components/delivery-map-placeholder";
import { DeliveryPartnerCard } from "@/apps/website/checkout/components/delivery-partner-card";
import { OrderStatusTimeline } from "@/components/shared/order-status-timeline";
import { OrderSummaryPanel } from "@/apps/website/checkout/components/order-summary-panel";
import { getDeliveryTrackingSnapshot } from "@/features/orders/lib/delivery-tracking";
import { getOrderTimeline } from "@/features/orders/lib/order-tracking";
import { formatOrderStatus } from "@/features/orders/lib/order-status-meta";
import { canViewOrder, readOrderLookupEmail } from "@/features/orders/lib/order-access";
import { getCustomerSession } from "@/apps/website/account/lib/customer-session";
import { getOrderByNumber, type PlacedOrder } from "@/features/orders/lib/orders";
import { fetchOrderByNumber } from "@/features/orders/lib/orders-api";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency, formatDate } from "@/utils/format";
import { formatOrderDeliveryDay } from "@/features/orders/lib/delivery-tracking";

const paymentLabels = {
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Card",
  razorpay: "Online (Razorpay)",
  paid: "Paid online",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
} as const;

export function OrderDetailPage() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = decodeURIComponent(params.orderNumber ?? "");
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);

  /**
   * Re-read the order — from the server when we can prove ownership.
   *
   * "Refresh status" used to re-read this browser's own cache, which cannot have
   * changed unless this same browser changed it. The one thing a customer
   * presses it for — has my order moved, has my refund gone through — was the
   * one thing it could never show.
   */
  async function refreshOrder() {
    if (!orderNumber) return;
    const email = readOrderLookupEmail(orderNumber) ?? getCustomerSession()?.email;
    if (email) {
      const fresh = await fetchOrderByNumber(orderNumber, { email });
      if (fresh) {
        setOrder(fresh);
        return;
      }
    }

    /**
     * A refresh that fails must not delete the order from the screen.
     *
     * This fell through to the local cache unconditionally, and the local cache
     * is empty for any order this browser did not itself write — an order
     * placed by the Razorpay webhook, or opened from a tracking link on another
     * device. So one failed request replaced a fully loaded order with `null`,
     * and the page rendered "Order Not Found" for an order that exists and that
     * the customer had been looking at a second earlier.
     */
    /**
     * The local copy is a FALLBACK, not a replacement for what is on screen.
     *
     * This adopted it unconditionally and returned, so the error toast below
     * was unreachable for everyone who had placed the order on this device —
     * and the local copy is the one written at placement, which never changes
     * again. Pressing "Refresh status" on a cancelled and refunded order, with
     * the request dropping, silently reverted the page to "Confirmed · Total
     * paid ₹1,200". The customer asked for the newest state and was shown an
     * older one, with nothing to say so.
     */
    if (!order) {
      const local = getOrderByNumber(orderNumber);
      if (local) {
        setOrder(local);
        return;
      }
    }

    toast.error("Could not refresh this order", {
      description: order
        ? "Showing the details we already have. Please try again in a moment."
        : "The server did not answer. Please try again in a moment.",
    });
  }

  useEffect(() => {
    if (!orderNumber) {
      setReady(true);
      return;
    }

    // Access is still decided locally where we can, so the page does not flash
    // a stranger's details while a request is in flight.
    const local = getOrderByNumber(orderNumber);
    const sessionEmail = getCustomerSession()?.email;
    const lookupEmail = readOrderLookupEmail(orderNumber) ?? sessionEmail ?? undefined;
    const localAllowed = local ? canViewOrder(local, sessionEmail) : false;

    setOrder(local);
    setAllowed(localAllowed);
    // Not ready until the server has answered, unless there is nothing to ask
    // with — otherwise the page renders "not found" for a webhook-placed order
    // a moment before its data arrives.
    if (!lookupEmail) setReady(true);

    let cancelled = false;
    if (lookupEmail) {
      // The SERVER's copy is the real one. The local copy is frozen at the
      // moment this browser stored it, so a refund, a cancellation or a payment
      // correction never showed here — and an order the WEBHOOK placed was not
      // in this browser at all, leaving the customer who most needed to track it
      // with nothing.
      void fetchOrderByNumber(orderNumber, { email: lookupEmail }).then((fresh) => {
        if (cancelled) return;
        if (fresh) {
          setOrder(fresh);
          setAllowed(true);
        }
        setReady(true);
      });
    }

    const onLocalChange = () => void refreshOrder();
    window.addEventListener("bakery-orders-updated", onLocalChange);
    return () => {
      cancelled = true;
      window.removeEventListener("bakery-orders-updated", onLocalChange);
    };
  }, [orderNumber]);

  const timeline = useMemo(() => (order ? getOrderTimeline(order) : []), [order]);
  const tracking = useMemo(
    () => (order ? getDeliveryTrackingSnapshot(order) : null),
    [order]
  );

  if (!ready) {
    return (
      <div className={layoutSpacing.container}>
        <div
          role="status"
          aria-live="polite"
          className="my-16 h-40 animate-pulse rounded-xl border border-border bg-cream-100"
        >
          {/* A bare pulsing box is silence to a screen reader — which then
              hears nothing at all until the verdict below replaces it. */}
          <span className="sr-only">Loading your order…</span>
        </div>
      </div>
    );
  }

  if (!order || !tracking || !allowed) {
    return (
      <>
        <StorePageHeader
          title="Order Not Found"
          description="We couldn't find an order with that number."
          breadcrumbs={[
            { label: "Track Order", href: routes.store.orderTrack },
            { label: "Not Found" },
          ]}
        />
        <section className={layoutSpacing.sectionY}>
          <div className={layoutSpacing.containerNarrow}>
            <div className="rounded-xl border border-border bg-white p-8 text-center">
              <p className="text-muted-foreground">
                Please check the order number, and look it up with the email used to
                place it.
              </p>
              <Button className="mt-6" variant="bakery" render={<Link href={routes.store.orderTrack} />}>
                Track another order
              </Button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <StorePageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed on ${formatDate(order.placedAt)}`}
        breadcrumbs={[
          { label: "Track Order", href: routes.store.orderTrack },
          { label: order.orderNumber },
        ]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{formatOrderStatus(order.status)}</Badge>
              <Badge variant="outline">
                {paymentLabels[order.paymentStatus] ?? paymentLabels[order.paymentMethod]}
              </Badge>
              {order.paymentReference ? (
                <Badge variant="outline">Ref {order.paymentReference}</Badge>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => void refreshOrder()}>
              <RefreshCw className="size-4" />
              Refresh status
            </Button>
          </div>

          <DeliveryEstimatedCard
            snapshot={tracking}
            orderNumber={order.orderNumber}
            className="mb-8"
          />

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-1">
                  <div className="flex items-center gap-2">
                    <Package className="size-5 text-bakery-700" />
                    <h2 className="font-heading text-lg font-semibold">Order timeline</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {/* The booked day, like the card above it — these two
                        disagreed for every shop west of UTC. */}
                    Estimated delivery:{" "}
                    {formatOrderDeliveryDay(order, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <div className="mt-6">
                    <OrderStatusTimeline steps={timeline} />
                  </div>
                </div>

                <div className="space-y-6">
                  <DeliveryMapPlaceholder
                    label={tracking.mapLabel}
                    active={tracking.showLiveMap}
                  />
                  {tracking.showPartner && tracking.partner ? (
                    <DeliveryPartnerCard
                      partner={tracking.partner}
                      delivered={order.status === "delivered"}
                    />
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-bakery-700" />
                  <h2 className="font-heading text-lg font-semibold">Delivery address</h2>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{order.address.fullName}</p>
                  <p>{order.address.phone}</p>
                  <p>{order.address.email}</p>
                  <p className="mt-2">
                    {[
                      order.address.addressLine1,
                      order.address.addressLine2,
                      order.address.city,
                      order.address.state,
                      order.address.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>

              {order.orderNotes ? (
                <div className="rounded-xl border border-border bg-cream-50 p-5 text-sm">
                  <p className="font-medium text-foreground">Special instructions</p>
                  <p className="mt-2 text-muted-foreground">{order.orderNotes}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <OrderSummaryPanel
                items={order.items}
                totals={order.totals}
                showEditLink={false}
              />
              <div className="rounded-xl border border-border bg-cream-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {order.paymentMethod === "cod" ? "Amount due on delivery" : "Total paid"}
                  </span>
                  <span className="font-semibold">{formatCurrency(order.totals.total)}</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" render={<Link href={routes.store.collections} />}>
                Order again
              </Button>
              <Button variant="ghost" className="w-full" render={<Link href={routes.store.orderTrack} />}>
                Track another order
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
