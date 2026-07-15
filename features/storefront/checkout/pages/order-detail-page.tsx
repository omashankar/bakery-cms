"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Package, RefreshCw } from "lucide-react";
import { DeliveryEstimatedCard } from "@/features/storefront/checkout/components/delivery-estimated-card";
import { DeliveryMapPlaceholder } from "@/features/storefront/checkout/components/delivery-map-placeholder";
import { DeliveryPartnerCard } from "@/features/storefront/checkout/components/delivery-partner-card";
import { OrderStatusTimeline } from "@/features/storefront/checkout/components/order-status-timeline";
import { OrderSummaryPanel } from "@/features/storefront/checkout/components/order-summary-panel";
import { getDeliveryTrackingSnapshot } from "@/features/storefront/checkout/lib/delivery-tracking";
import { getOrderTimeline } from "@/features/storefront/checkout/lib/order-tracking";
import { formatOrderStatus } from "@/features/storefront/checkout/lib/order-status-meta";
import { getOrderByNumber, type PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency, formatDate } from "@/utils/format";

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
  const [ready, setReady] = useState(false);

  function refreshOrder() {
    if (!orderNumber) return;
    setOrder(getOrderByNumber(orderNumber));
  }

  useEffect(() => {
    refreshOrder();
    setReady(true);
    window.addEventListener("bakery-orders-updated", refreshOrder);
    return () => window.removeEventListener("bakery-orders-updated", refreshOrder);
  }, [orderNumber]);

  const timeline = useMemo(() => (order ? getOrderTimeline(order) : []), [order]);
  const tracking = useMemo(
    () => (order ? getDeliveryTrackingSnapshot(order) : null),
    [order]
  );

  if (!ready) {
    return (
      <div className={layoutSpacing.container}>
        <div className="my-16 h-40 animate-pulse rounded-xl border border-border bg-cream-100" />
      </div>
    );
  }

  if (!order || !tracking) {
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
              <p className="text-muted-foreground">Please check the order number and try again.</p>
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
            <Button variant="outline" size="sm" onClick={refreshOrder}>
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
                    Estimated delivery: {formatDate(order.estimatedDelivery)}
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
                  <span className="text-muted-foreground">Total paid</span>
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
