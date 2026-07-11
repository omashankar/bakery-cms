"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Package } from "lucide-react";
import { getOrderByNumber, type PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency, formatDate } from "@/utils/format";

const paymentLabels = {
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Card",
} as const;

export function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    setOrder(getOrderByNumber(orderNumber));
  }, [orderNumber]);

  return (
    <>
      <StorePageHeader
        title="Order Confirmed"
        description="Thank you for your order. We're preparing your cakes with care."
        breadcrumbs={[{ label: "Order Confirmed" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-green-50">
              <CheckCircle2 className="size-8 text-green-600" />
            </div>
            <h2 className="font-heading text-2xl font-bold">Thank you for your order!</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Your order has been placed successfully. A confirmation email will be sent shortly.
            </p>

            {order ? (
              <div className="mx-auto mt-8 max-w-lg rounded-xl border border-border bg-cream-50 p-6 text-left text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Package className="size-4 text-bakery-700" />
                  Order {order.orderNumber}
                </div>
                <dl className="mt-4 space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Total paid</dt>
                    <dd className="font-semibold">{formatCurrency(order.totals.total)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>{paymentLabels[order.paymentMethod]}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Estimated delivery</dt>
                    <dd>{formatDate(order.estimatedDelivery)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd>{order.totals.itemCount}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                Order details are saved locally for this demo.
              </p>
            )}

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="bakery" render={<Link href={routes.store.collections} />}>
                Continue shopping
              </Button>
              {order ? (
                <Button
                  variant="outline"
                  render={<Link href={routes.store.orderDetail(order.orderNumber)} />}
                >
                  Track order
                </Button>
              ) : (
                <Button variant="outline" render={<Link href={routes.store.orderTrack} />}>
                  Track order
                </Button>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link href={routes.account.dashboard} className="text-bakery-700 hover:underline">
                View account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
