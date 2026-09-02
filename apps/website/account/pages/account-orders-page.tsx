"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { AccountOrderStatusBadge } from "@/apps/website/account/components/account-order-status-badge";
import { AccountShell } from "@/apps/website/account/components/account-shell";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { cartLineChoices } from "@/features/cart/lib/cart";
import { reorderFromOrder } from "@/apps/website/lib/reorder";
import { fetchProducts } from "@/features/products/data/products-client";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/utils/format";
import { useBusinessLabels } from "@/hooks/use-business-labels";

const PAGE_SIZE = 10;

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
      description="View and track all your orders."
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
              className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
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
              <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {order.items.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span className="font-medium text-foreground">{item.quantity} ×</span>{" "}
                      {item.name}
                      {/*
                        The customer's own record of what they ordered. It read
                        "2 × Chocolate Truffle Cake" and stopped — no size, no
                        flavour, and none of the options they were charged for —
                        so the one page they can check their own order on could
                        not tell two different orders of the same product apart.
                      */}
                      {cartLineChoices(item).length > 0 ? (
                        <span className="block text-xs">
                          {cartLineChoices(item).join(" · ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {order.items.length > 3 ? (
                    <li className="text-bakery-700">
                      +{order.items.length - 3} more item
                      {order.items.length - 3 === 1 ? "" : "s"}
                    </li>
                  ) : null}
                </ul>

                <div className="flex flex-col items-start gap-3 lg:items-end">
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
                      Track order
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
