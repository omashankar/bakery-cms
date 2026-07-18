"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { AccountOrderStatusBadge } from "@/apps/website/account/components/account-order-status-badge";
import { AccountShell } from "@/apps/website/account/components/account-shell";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import { getOrdersForCustomer } from "@/features/orders/lib/orders";
import { reorderFromOrder } from "@/apps/website/lib/reorder";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/utils/format";

const PAGE_SIZE = 10;

export function AccountOrdersPage() {
  const router = useRouter();
  const { session, ready } = useCustomerAuth();
  const [page, setPage] = useState(1);

  const orders = useMemo(
    () => (session ? getOrdersForCustomer(session.email) : []),
    [session]
  );

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleReorder(orderNumber: string) {
    const order = orders.find((entry) => entry.orderNumber === orderNumber);
    if (!order) return;

    const result = reorderFromOrder(order);
    if (result.added === 0) {
      toast.error("Could not reorder — items may be unavailable");
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
      description="View and track all your bakery orders."
      breadcrumbs={[{ label: "Orders" }]}
    >
      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order, it will appear here."
          action={
            <Button variant="bakery" render={<Link href={routes.store.collections} />}>
              Browse cakes
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
