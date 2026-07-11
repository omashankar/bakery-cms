"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { AccountOrderStatusBadge } from "@/features/storefront/account/components/account-order-status-badge";
import { AccountShell } from "@/features/storefront/account/components/account-shell";
import { useCustomerAuth } from "@/features/storefront/account/hooks/use-customer-auth";
import { getOrdersForCustomer } from "@/features/storefront/checkout/lib/orders";
import { reorderFromOrder } from "@/features/storefront/lib/reorder";
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
        <div className="space-y-3">
          {paginated.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-border bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-semibold">{order.orderNumber}</h2>
                    <AccountOrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Placed on {formatDate(order.placedAt)}
                  </p>
                  <ul className="text-sm text-muted-foreground">
                    {order.items.slice(0, 2).map((item) => (
                      <li key={item.id}>
                        {item.quantity} × {item.name}
                      </li>
                    ))}
                    {order.items.length > 2 ? (
                      <li>+{order.items.length - 2} more items</li>
                    ) : null}
                  </ul>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <p className="text-lg font-semibold">{formatCurrency(order.totals.total)}</p>
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
