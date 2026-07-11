"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import {
  EMPTY_DASHBOARD_COMMERCE_ANALYTICS,
  getDashboardCommerceAnalytics,
  getDashboardRangeLabel,
  type DashboardDateRange,
} from "../lib/dashboard-analytics";

interface DashboardPaymentMixProps {
  range: DashboardDateRange;
}

export function DashboardPaymentMix({ range }: DashboardPaymentMixProps) {
  const [items, setItems] = useState(EMPTY_DASHBOARD_COMMERCE_ANALYTICS.paymentBreakdown);

  useEffect(() => {
    function refresh() {
      setItems(getDashboardCommerceAnalytics(range).paymentBreakdown);
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, [range]);

  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  const maxRevenue = Math.max(...items.map((item) => item.revenue), 1);

  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4 text-primary" />
          Payment mix
        </CardTitle>
        <CardDescription>
          Methods for {getDashboardRangeLabel(range).toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No payment data in this period.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">
                  {item.count} · {formatCurrency(item.revenue)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold-500 transition-all"
                  style={{ width: `${Math.max(8, Math.round((item.revenue / maxRevenue) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}

        {totalRevenue > 0 ? (
          <p className="pt-1 text-xs text-muted-foreground">
            {formatCurrency(totalRevenue)} collected in selected range
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
