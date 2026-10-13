"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, MapPin, Package } from "lucide-react";
import { toast } from "@/lib/lazy-toast";
import { AccountOrderStatusBadge } from "@/apps/website/account/components/account-order-status-badge";
import { AccountShell } from "@/apps/website/account/components/account-shell";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { cartLineChoices } from "@/features/cart/lib/cart";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import { reorderFromOrder } from "@/apps/website/lib/reorder";
import { fetchProducts } from "@/features/products/data/products-client";
import { EmptyState } from "@/components/shared/empty-state";
import { OptimizedImage } from "@/components/shared/optimized-image";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { formatCalendarDate, formatCurrency, formatDate } from "@/utils/format";
import { useBusinessLabels } from "@/hooks/use-business-labels";

const PAGE_SIZE = 10;

/** Orders with nothing left to happen to them. */
const FINAL_STATUSES = new Set<PlacedOrder["status"]>(["delivered", "cancelled", "refunded"]);

/** The heading over the order's date line. */
function deliveryLabel(order: PlacedOrder): string {
  if (order.status === "delivered") return "Delivered on";
  if (order.status === "cancelled" || order.status === "refunded") return "Delivery";
  return order.deliverySlot?.date ? "Delivery on" : "Expected by";
}

/**
 * When it arrived, or is due — from the order's own record.
 *
 * Delivered: the moment the shop marked it so, falling back to the day that
 * was booked. Still to come: the day and window chosen at checkout, which is
 * a calendar date ("2026-10-06") and goes through `formatCalendarDate` so no
 * timezone can move it to the day before.
 */
function deliveryWhen(order: PlacedOrder): string {
  const slot = order.deliverySlot;
  const booked = slot?.date
    ? formatCalendarDate(slot.date, { weekday: "short", day: "numeric", month: "short" })
    : "";
  if (order.status === "delivered") {
    const at = [...order.statusHistory].reverse().find((event) => event.status === "delivered")?.at;
    return at ? formatDate(at) : booked || "—";
  }
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "refunded") return "Refunded";
  if (booked) return slot?.timeSlot ? `${booked} · ${slot.timeSlot}` : booked;
  return order.estimatedDelivery ? formatDate(order.estimatedDelivery) : "To be confirmed";
}

/**
 * How it was paid, in the customer's words. A refund is named only once money
 * has actually gone back (`settledRefundAmount`); a refund still being worked
 * on says so, and nothing is promised beyond the record.
 */
function paymentText(order: PlacedOrder): string {
  const refunded = settledRefundAmount(order);
  if (refunded > 0) return `Refunded ${formatCurrency(refunded)}`;
  if (order.refundRecord?.status === "requested" || order.refundRecord?.status === "processing") {
    return "Refund in progress";
  }
  switch (order.paymentStatus) {
    case "paid":
      return "Paid online";
    case "cod":
      return order.status === "delivered" ? "Paid on delivery" : "Cash on delivery";
    case "refunded":
      return "Refunded";
    case "failed":
      return "Payment failed";
    default:
      return "Payment pending";
  }
}

export function AccountOrdersPage() {
  const labels = useBusinessLabels();
  const router = useRouter();
  const { session, ready } = useCustomerAuth();
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<PlacedOrder[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  /**
   * The customer's orders, FROM THE SHOP.
   *
   * This was `getOrdersForCustomer(session.email)` — this browser's own
   * localStorage cache, filtered by an email the browser had also chosen. So
   * the page was wrong in three directions at once: an order placed on a phone
   * was invisible on a laptop, every order was frozen at the moment of placing
   * (a refund, a cancellation or a status change never appeared), and an order
   * the payment webhook had placed after the tab died was in no browser at all.
   *
   * `/api/customer-auth/orders` takes the email from the SESSION COOKIE, never
   * from the request, so this cannot be pointed at anyone else's history.
   */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/customer-auth/orders", { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { data?: PlacedOrder[] };
        if (!cancelled) {
          setOrders(body.data ?? []);
          setLoadError(false);
        }
      } catch {
        // NOT an empty list. "No orders yet" is a claim about the shop's
        // records, and a failed request is not entitled to make it.
        if (!cancelled) {
          setOrders([]);
          setLoadError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const totalPages = Math.max(1, Math.ceil((orders?.length ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = (orders ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /**
   * The SHOP's catalogue, fetched when it is needed.
   *
   * Reorder used to resolve products through the browser's cache, which on a
   * customer's device holds the shipped demo cakes — so every reorder of a real
   * order failed with "items may be unavailable". `/api/products` serves the
   * published catalogue to anyone, which is what this needs and all it needs.
   */
  async function handleReorder(orderNumber: string) {
    const order = (orders ?? []).find((entry) => entry.orderNumber === orderNumber);
    if (!order) return;

    let catalogue;
    try {
      catalogue = await fetchProducts();
    } catch {
      // Distinct from "unavailable": nothing has been checked yet.
      toast.error("Could not reach the store", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    const result = reorderFromOrder(
      order,
      catalogue.map((product) => ({
        slug: product.slug,
        image: product.images?.[0],
        // The same flag the storefront reads, not the quantity.
        inStock: product.stockStatus !== "out_of_stock",
      })),
    );
    if (result.added === 0) {
      toast.error("Could not reorder — items may be unavailable", {
        description: result.unavailable.length
          ? `${result.unavailable.join(", ")} ${result.unavailable.length === 1 ? "is" : "are"} no longer available.`
          : undefined,
      });
      return;
    }

    toast.success(`Added ${result.added} item${result.added === 1 ? "" : "s"} to cart`, {
      description:
        result.skipped > 0
          ? `${result.skipped} unavailable item${result.skipped === 1 ? "" : "s"} skipped`
          : undefined,
    });
    router.push(routes.store.cart);
  }

  if (!ready || !session) {
    return null;
  }

  return (
    <AccountShell
      title="My Orders"
      breadcrumbs={[{ label: "Orders" }]}
    >
      {orders === null ? (
        /*
          Not an empty state. Until the shop has answered, this page does not
          know whether there are orders — and "No orders yet" is a claim about
          the shop's records, not about a request still in flight.
        */
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl border border-border bg-cream-50"
            />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={Package}
          title="We could not load your orders"
          description="Something went wrong reaching the store. Your orders are safe — please try again."
          action={
            <Button variant="bakery" onClick={() => router.refresh()}>
              Try again
            </Button>
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order, it will appear here."
          action={
            <Button variant="bakery" render={<Link href={routes.store.collections} />}>
              Browse {labels.productWordPlural.toLowerCase()}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {paginated.map((order) => (
            <div
              key={order.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-cream-50 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bakery-700 text-white">
                    <Package className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-heading text-base font-bold text-foreground">
                      {order.orderNumber}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Placed on {formatDate(order.placedAt)}
                    </p>
                  </div>
                </div>
                <AccountOrderStatusBadge status={order.status} />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  {/*
                    WHAT WAS ORDERED, WITH ITS PICTURE — the photo the line was
                    placed with, which is stored on the order itself, so it is
                    the cake they bought even if the product's photos have
                    changed since. Name and picture lead to the product.
                  */}
                  <ul className="space-y-3">
                    {order.items.slice(0, 3).map((item) => {
                      const choices = cartLineChoices(item);
                      return (
                        <li key={item.id} className="flex items-center gap-3">
                          <Link
                            href={routes.store.product(item.productSlug)}
                            className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
                            aria-hidden="true"
                            tabIndex={-1}
                          >
                            {item.image ? (
                              <OptimizedImage
                                src={item.image}
                                alt=""
                                width={64}
                                height={64}
                                className="size-full object-cover"
                              />
                            ) : (
                              <Package className="size-6 text-muted-foreground" />
                            )}
                          </Link>
                          <div className="min-w-0 text-sm">
                            <Link
                              href={routes.store.product(item.productSlug)}
                              className="line-clamp-2 font-medium text-foreground hover:underline"
                            >
                              {item.name}
                            </Link>
                            {/*
                              The customer's own record of what they ordered:
                              size, flavour and every option they were charged
                              for, so two orders of one product can be told
                              apart.
                            */}
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Qty {item.quantity}
                              {choices.length > 0 ? ` · ${choices.join(" · ")}` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {order.items.length > 3 ? (
                    <p className="text-sm font-medium text-bakery-700">
                      +{order.items.length - 3} more item
                      {order.items.length - 3 === 1 ? "" : "s"}
                    </p>
                  ) : null}

                  {/*
                    WHEN, WHERE AND HOW IT WAS PAID — the three things a
                    customer opens this page to check, all on the order already.
                  */}
                  <dl className="grid gap-2 rounded-xl bg-muted/60 px-4 py-3 text-xs sm:grid-cols-3">
                    <div className="flex items-start gap-2">
                      <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <dt className="text-muted-foreground">{deliveryLabel(order)}</dt>
                        <dd className="font-medium text-foreground">{deliveryWhen(order)}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Deliver to</dt>
                        <dd className="truncate font-medium text-foreground">
                          {[order.address.fullName, order.address.city, order.address.pincode]
                            .filter(Boolean)
                            .join(", ")}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CreditCard aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <dt className="text-muted-foreground">Payment</dt>
                        <dd className="font-medium text-foreground">{paymentText(order)}</dd>
                      </div>
                    </div>
                  </dl>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                  <div className="text-left lg:text-right">
                    <p className="text-xs text-muted-foreground">Order total</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(order.totals.total)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={routes.store.orderDetail(order.orderNumber)} />}
                    >
                      {/*
                        Nothing is left to track on an order that has arrived
                        or been called off; it is the details that are wanted.
                      */}
                      {FINAL_STATUSES.has(order.status) ? "View details" : "Track order"}
                    </Button>
                    <Button
                      variant="bakery"
                      size="sm"
                      onClick={() => handleReorder(order.orderNumber)}
                    >
                      Reorder
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {orders.length > PAGE_SIZE ? (
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      )}
    </AccountShell>
  );
}
