"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { AdminOrderStatusBadge } from "@/apps/admin/commerce/components/admin-order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PanelLoading } from "@/components/shared/panel-loading";
import { routes } from "@/constants/routes";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { getRecentOrders } from "../lib/dashboard-data";
import { subscribeToAdminData } from "@/apps/admin/lib/admin-data-events";
import { useOrdersServerSync } from "@/features/orders/lib/use-orders-server-sync";

export function DashboardRecentOrders() {
  /**
   * This screen's own data, asked for NOW.
   *
   * The admin layout hydrates every admin cache — this one included — but only
   * after `useIdle(1000)`, so that the screen the admin opened gets the
   * connection first. For a screen whose content IS one of those caches that is
   * backwards: it spent that second waiting on a delay meant to help it.
   *
   * Mounting the same hook here costs nothing — `hydrateOnce` makes the
   * layout's later call join this read rather than repeat it — and the rest of
   * the batch still waits its turn.
   */
  useOrdersServerSync();

  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  /**
   * Whether the first effect has run.
   *
   * The read below is synchronous, but `useEffect` fires after the browser
   * paints — so without this there is a real frame stating the shop has none of
   * these. It cannot be read eagerly instead: this renders on the server too,
   * where the browser-held store is empty, and seeding from it would be a
   * hydration mismatch.
   */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function refresh() {
      setOrders(getRecentOrders(4));
      setLoaded(true);
    }

    refresh();
    return subscribeToAdminData(refresh);
  }, []);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Recent orders</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          render={<Link href={routes.admin.orders.list} />}
        >
          View all
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        {!loaded ? (
          <PanelLoading label="Loading recent orders" rows={4} />
        ) : orders.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <div>
              <ShoppingBag className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No orders yet</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={routes.admin.orders.detail(order.id)}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.orderNumber}
                      </p>
                      <AdminOrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.address.fullName} · {formatRelativeTime(order.placedAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatCurrency(order.totals.total)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
