"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Package, SearchX } from "lucide-react";
import { getOrderByNumber, type PlacedOrder } from "@/features/orders/lib/orders";
import { fetchOrderByNumber } from "@/features/orders/lib/orders-api";
import { readOrderLookupEmail } from "@/features/orders/lib/order-access";
import { hasCustomerSession } from "@/apps/website/account/lib/customer-session";
import { openCustomerAuthModal } from "@/apps/website/account/components/customer-auth-modal";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency } from "@/utils/format";
import { formatOrderDeliveryDay } from "@/features/orders/lib/delivery-tracking";

const paymentLabels = {
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Card",
  razorpay: "Online (Razorpay)",
} as const;

/**
 * Whether this page has an order yet — which is NOT the same as having one.
 *
 * `order` is null for three different reasons and this screen used to treat
 * them all as the third: nothing has been looked up yet, the server is still
 * answering, or there really is no such order. So the very first paint of a
 * successful checkout — and every frame until the fetch landed — read "We could
 * not find that order" beneath a green tick, an "Order Confirmed" page title and
 * "Thank you for your order. We're preparing your cakes with care." A customer
 * whose money had just left their account read that the shop had lost it.
 */
type Lookup = "looking" | "found" | "missing";

export function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [lookup, setLookup] = useState<Lookup>("looking");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // A link with no order on it is the one case that is knowable immediately.
    if (!orderNumber) {
      setLookup("missing");
      return;
    }

    const local = getOrderByNumber(orderNumber);
    if (local) {
      setOrder(local);
      setLookup("found");
    }

    // Re-read from the server once.
    //
    // The payment status shown here is the one the browser recorded, and it can
    // be out of date within seconds: a capture the placement lookup could not
    // confirm lands as `pending`, and the gateway's webhook corrects it moments
    // later. This is exactly the screen where a customer who has just paid reads
    // "pending" and worries.
    const email = readOrderLookupEmail(orderNumber) ?? local?.address?.email;
    if (!email) {
      // Nothing left to try. Only now is "we could not find it" true — and only
      // if the device had no copy either.
      if (!local) setLookup("missing");
      return;
    }

    let cancelled = false;
    void fetchOrderByNumber(orderNumber, { email }).then((fresh) => {
      if (cancelled) return;
      if (fresh) {
        setOrder(fresh);
        setLookup("found");
      } else if (!local) {
        // `fetchOrderByNumber` answers null for a network failure too, so this
        // says "could not load", never "your order does not exist".
        setLookup("missing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  useEffect(() => {
    setSignedIn(hasCustomerSession());
  }, []);

  const looking = lookup === "looking";
  // The heading, the icon and the page title are one verdict, so they are
  // decided together. They used to disagree: only the h2 knew the order was
  // missing, while the tick above it and the title above that both celebrated.
  const heading = looking
    ? "Checking your order…"
    : order
      ? "Thank you for your order!"
      : "We could not load that order";

  return (
    <>
      <StorePageHeader
        title={looking ? "Your Order" : order ? "Order Confirmed" : "Order Not Found"}
        description={
          looking
            ? "One moment while we fetch your order details."
            : order
              ? "Thank you for your order. We're preparing your cakes with care."
              : "Look it up with your order number, or contact us and we will help."
        }
        breadcrumbs={[{ label: looking ? "Your Order" : order ? "Order Confirmed" : "Order" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <ScrollReveal className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="relative mx-auto mb-4 flex size-16 items-center justify-center">
              {looking ? (
                <span className="relative flex size-16 items-center justify-center rounded-2xl bg-muted">
                  <Loader2 className="size-9 animate-spin text-muted-foreground" />
                </span>
              ) : order ? (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-green-100 opacity-60 [animation-iteration-count:2]" />
                  <span className="relative flex size-16 items-center justify-center rounded-2xl bg-green-50 animate-in zoom-in-50 duration-500">
                    <CheckCircle2 className="size-9 text-green-600" />
                  </span>
                </>
              ) : (
                <span className="relative flex size-16 items-center justify-center rounded-2xl bg-amber-50">
                  <SearchX className="size-9 text-amber-600" />
                </span>
              )}
            </div>
            <h2 className="font-heading text-2xl font-bold" aria-live="polite">
              {heading}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              {looking
                ? "We're fetching the details for this order."
                : order
                  ? "Your order has been placed successfully. Save your order number below — you can use it to track this order at any time."
                  : "This link has no order attached, or the order was placed on another device. Look it up with your order number below."}
            </p>

            {looking ? (
              <div className="mx-auto mt-8 max-w-lg space-y-3 rounded-xl border border-border bg-cream-50 p-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : order ? (
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
                      {/*
                        The booked calendar day, not the instant derived from
                        it. `estimatedDelivery` for a slot-booked order is
                        midnight UTC of the chosen date, so rendering it in a
                        shop timezone west of UTC put the confirmation a day
                        earlier than the order.
                      */}
                      {formatOrderDeliveryDay(order, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
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
              {/*
                No order-specific link while the lookup is open: "Track order"
                would have to point at either this order or the generic search,
                and picking one is the same guess the heading used to make.
              */}
              {looking ? null : order ? (
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
