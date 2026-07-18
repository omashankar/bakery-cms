"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import {
  getInventoryOverview,
  INVENTORY_UPDATED_EVENT,
} from "@/apps/admin/commerce/lib/inventory-repository";
import type { InventoryOverview } from "@/types/inventory";

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

  useEffect(() => {
    function refresh() {
      setOverview(getInventoryOverview());
    }

    refresh();
    window.addEventListener(INVENTORY_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, refresh);
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
            <p className="font-heading text-xl font-semibold text-amber-700 dark:text-amber-400">{overview.lowStock}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Out of stock</p>
            <p className="font-heading text-xl font-semibold text-destructive">
              {overview.outOfStock}
            </p>
          </div>
        </div>

        {overview.alertCount > 0 ? (
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
