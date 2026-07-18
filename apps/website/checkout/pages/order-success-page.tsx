"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Package } from "lucide-react";
import { getOrderByNumber, type PlacedOrder } from "@/features/orders/lib/orders";
import { hasCustomerSession } from "@/apps/website/account/lib/customer-session";
import { openCustomerAuthModal } from "@/apps/website/account/components/customer-auth-modal";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency, formatDate } from "@/utils/format";

const paymentLabels = {
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Card",
  razorpay: "Online (Razorpay)",
} as const;

export function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!orderNumber) return;
    setOrder(getOrderByNumber(orderNumber));
  }, [orderNumber]);

  useEffect(() => {
    setSignedIn(hasCustomerSession());
  }, []);

  return (
    <>
      <StorePageHeader
        title="Order Confirmed"
        description="Thank you for your order. We're preparing your cakes with care."
        breadcrumbs={[{ label: "Order Confirmed" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <ScrollReveal className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="relative mx-auto mb-4 flex size-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-green-100 opacity-60 [animation-iteration-count:2]" />
              <span className="relative flex size-16 items-center justify-center rounded-2xl bg-green-50 animate-in zoom-in-50 duration-500">
                <CheckCircle2 className="size-9 text-green-600" />
              </span>
            </div>
            <h2 className="font-heading text-2xl font-bold">
              {order ? "Thank you for your order!" : "We could not find that order"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              {order
                ? "Your order has been placed successfully. Save your order number below — you can use it to track this order at any time."
                : "This link has no order attached, or the order was placed on another device. Look it up with your order number below."}
            </p>

            {order ? (
              <div className="mx-auto mt-8 max-w-lg rounded-xl border border-border bg-cream-50 p-6 text-left text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Package className="size-4 text-bakery-700" />
                  Order {order.orderNumber}
                </div>
                <dl className="mt-4 space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {order.paymentMethod === "cod" ? "Amount due on delivery" : "Total paid"}
                    </dt>
                    <dd className="font-semibold">{formatCurrency(order.totals.total)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>{paymentLabels[order.paymentMethod]}</dd>
                  </div>
                  {order.paymentReference ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Transaction ID</dt>
                      <dd className="font-medium">{order.paymentReference}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {order.deliverySlot?.timeSlot ? "Delivery" : "Estimated delivery"}
                    </dt>
                    <dd className="text-right">
                      {formatDate(order.estimatedDelivery)}
                      {order.deliverySlot?.timeSlot ? (
                        <span className="block text-xs text-muted-foreground">
                          {order.deliverySlot.timeSlot}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd>{order.totals.itemCount}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                We could not load the details for this order here. Use{" "}
                <span className="font-medium text-foreground">Track order</span> below, or
                contact us with your order number and we will help.
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
              {order ? (
                <Button
                  variant="outline"
                  render={<Link href={routes.store.orderInvoice(order.orderNumber)} />}
                >
                  <Download className="size-4" />
                  View invoice
                </Button>
              ) : null}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Questions about this order?{" "}
              <Link href={routes.store.contact} className="text-bakery-700 hover:underline">
                Contact us
              </Link>
            </p>

            {signedIn ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link href={routes.account.dashboard} className="text-bakery-700 hover:underline">
                  View account
                </Link>
              </p>
            ) : (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Want to track all your orders in one place?{" "}
                <button
                  type="button"
                  onClick={() => openCustomerAuthModal("signup")}
                  className="font-medium text-bakery-700 hover:underline"
                >
                  Create an account
                </button>
              </p>
            )}
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
