"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";
import {
  type DashboardCommerceAnalytics,
} from "../lib/dashboard-analytics";

interface DashboardTopProductsProps {
  analytics: DashboardCommerceAnalytics;
}

export function DashboardTopProducts({ analytics }: DashboardTopProductsProps) {
  const products = analytics.topProducts.slice(0, 4);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="min-w-0 truncate text-base">Top sellers</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          render={<Link href={routes.admin.reports} />}
        >
          Reports
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        {products.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <div>
              <ShoppingBag className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No sales yet</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {products.map((product, index) => (
              <li key={product.slug}>
                <Link
                  href={routes.store.cake(product.slug)}
                  className="flex items-center justify-between gap-3 py-2.5 transition-premium hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.quantity} sold · {formatCurrency(product.revenue)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-foreground">
                    #{index + 1}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
