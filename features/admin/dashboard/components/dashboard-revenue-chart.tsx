"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";
import {
  EMPTY_DASHBOARD_COMMERCE_ANALYTICS,
  getDashboardCommerceAnalytics,
  type DashboardDateRange,
} from "../lib/dashboard-analytics";

interface DashboardRevenueChartProps {
  range: DashboardDateRange;
}

export function DashboardRevenueChart({ range }: DashboardRevenueChartProps) {
  const [analytics, setAnalytics] = useState(EMPTY_DASHBOARD_COMMERCE_ANALYTICS);

  useEffect(() => {
    function refresh() {
      setAnalytics(getDashboardCommerceAnalytics(range));
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, [range]);

  const trend = analytics.trend;
  const maxRevenue = Math.max(...trend.map((item) => item.revenue), 1);
  const latest = trend[trend.length - 1];
  const hasData = trend.some((item) => item.revenue > 0 || item.orders > 0);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="min-w-0 truncate text-base">Revenue trend</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          render={<Link href={routes.admin.reports} />}
        >
          Reports
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 pt-0">
        <div className="overflow-x-auto rounded-xl border border-dashed border-border bg-muted/50 p-3 sm:p-4">
          {!hasData ? (
            <div className="flex h-36 items-center justify-center sm:h-44">
              <p className="text-sm text-muted-foreground">No sales data yet</p>
            </div>
          ) : (
            <div
              className="grid h-36 gap-1 border-b border-border/70 sm:h-44 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.max(trend.length, 1)}, minmax(${trend.length > 14 ? "18px" : "0"}, 1fr))`,
                minWidth: trend.length > 14 ? `${trend.length * 22}px` : undefined,
              }}
            >
              {trend.map((item, index) => {
                const hasRevenue = item.revenue > 0;
                const height = hasRevenue
                  ? Math.max(12, Math.round((item.revenue / maxRevenue) * 92))
                  : 3;
                const isCurrent = index === trend.length - 1;
                const showLabel =
                  trend.length <= 8 ||
                  index % Math.ceil(trend.length / 6) === 0 ||
                  index === trend.length - 1;

                return (
                  <div
                    key={`${item.label}-${index}`}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"
                  >
                    <div className="flex h-full w-full items-end">
                      <div
                        className="w-full rounded-t-sm bg-gold-300 transition-colors hover:bg-gold-400 data-[active=true]:bg-bakery-500 data-[empty=true]:bg-border"
                        data-active={isCurrent}
                        data-empty={!hasRevenue}
                        style={{ height: `${height}%` }}
                        title={`${item.label}: ${formatCurrency(item.revenue)} · ${item.orders} ${item.orders === 1 ? "order" : "orders"}`}
                      />
                    </div>
                    {showLabel ? (
                      <span className="max-w-full truncate text-[9px] text-muted-foreground sm:text-[10px]">
                        {item.label}
                      </span>
                    ) : (
                      <span className="h-3" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-lg border border-border bg-muted/80 px-2 py-2 text-xs sm:px-3">
            <p className="text-muted-foreground">Revenue</p>
            <p className="mt-1 truncate font-semibold">
              {formatCurrency(analytics.summary.revenue)}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-muted/80 px-2 py-2 text-xs sm:px-3">
            <p className="text-muted-foreground">Orders</p>
            <p className="mt-1 font-semibold">{analytics.summary.orders}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-muted/80 px-2 py-2 text-xs sm:px-3">
            <p className="text-muted-foreground">Latest</p>
            <p className="mt-1 truncate font-semibold">
              {latest?.orders ?? 0} {(latest?.orders ?? 0) === 1 ? "order" : "orders"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
