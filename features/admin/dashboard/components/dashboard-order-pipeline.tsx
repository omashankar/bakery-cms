"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminOrderStatusBadge } from "@/features/admin/commerce/components/admin-order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";
import {
  EMPTY_DASHBOARD_COMMERCE_ANALYTICS,
  getDashboardCommerceAnalytics,
  type DashboardDateRange,
} from "../lib/dashboard-analytics";

interface DashboardOrderPipelineProps {
  range: DashboardDateRange;
}

export function DashboardOrderPipeline({ range }: DashboardOrderPipelineProps) {
  const [breakdown, setBreakdown] = useState(EMPTY_DASHBOARD_COMMERCE_ANALYTICS.statusBreakdown);

  useEffect(() => {
    function refresh() {
      setBreakdown(getDashboardCommerceAnalytics(range).statusBreakdown);
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, [range]);

  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(...breakdown.map((item) => item.count), 1);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="min-w-0 truncate text-base">Order pipeline</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          render={<Link href={routes.admin.orders.list} />}
        >
          Orders
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
        {breakdown.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            No orders yet
          </p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((item) => (
              <div key={item.status} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <AdminOrderStatusBadge status={item.status} />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.count} · {formatCurrency(item.revenue)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.max(8, Math.round((item.count / maxCount) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">{total}</span>
        </div>
      </CardContent>
    </Card>
  );
}
