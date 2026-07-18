"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { AdminOrderStatusBadge } from "@/features/admin/commerce/components/admin-order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { getRecentOrders } from "../lib/dashboard-data";

export function DashboardRecentOrders() {
  const [orders, setOrders] = useState<PlacedOrder[]>([]);

  useEffect(() => {
    function refresh() {
      setOrders(getRecentOrders(4));
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
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
        {orders.length === 0 ? (
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
