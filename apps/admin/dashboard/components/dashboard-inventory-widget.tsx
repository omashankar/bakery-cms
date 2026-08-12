"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/constants/routes";
import { getInventoryOverview } from "@/apps/admin/commerce/lib/inventory-repository";
import type { InventoryOverview } from "@/types/inventory";
import { subscribeToAdminData } from "@/apps/admin/lib/admin-data-events";

const EMPTY_INVENTORY_OVERVIEW: InventoryOverview = {
  totalSkus: 0,
  inStock: 0,
  lowStock: 0,
  outOfStock: 0,
  unlimited: 0,
  alertCount: 0,
  totalUnits: 0,
};

export function DashboardInventoryWidget() {
  const [overview, setOverview] = useState(EMPTY_INVENTORY_OVERVIEW);
  // Zero low-stock and zero out-of-stock is the single most reassuring thing
  // this widget can say, and it said it before the first effect had run.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function refresh() {
      setOverview(getInventoryOverview());
      setLoaded(true);
    }

    refresh();
    return subscribeToAdminData(refresh);
  }, []);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="min-w-0 truncate text-base">Inventory</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          render={<Link href={routes.admin.commerce.inventory} />}
        >
          Open
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Low stock</p>
            {loaded ? (
              <p className="font-heading text-xl font-semibold text-amber-700 dark:text-amber-400">
                {overview.lowStock}
              </p>
            ) : (
              <Skeleton className="my-1 h-5 w-10" />
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Out of stock</p>
            {loaded ? (
              <p className="font-heading text-xl font-semibold text-destructive">
                {overview.outOfStock}
              </p>
            ) : (
              <Skeleton className="my-1 h-5 w-10" />
            )}
          </div>
        </div>

        {loaded && overview.alertCount > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <p>
              {overview.alertCount} product{overview.alertCount === 1 ? "" : "s"} need attention
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
