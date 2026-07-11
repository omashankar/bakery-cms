"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Download,
  IndianRupee,
  Package,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { AdminOrderStatusBadge } from "@/features/admin/commerce/components/admin-order-status-badge";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import {
  exportReportsCsv,
  filterOrdersByPreviousRange,
  filterOrdersByRange,
  getCityBreakdown,
  getCouponBreakdown,
  getPaymentBreakdown,
  getRecentReportOrders,
  getReportsComparison,
  getReportsSummary,
  getRevenueTrend,
  getStatusBreakdown,
  getTopCustomers,
  getTopProducts,
  loadReportOrders,
  type ReportDateRange,
  type ReportsComparison,
} from "../lib/reports-data";

const rangeOptions: Array<{ value: ReportDateRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

const emptySummary = getReportsSummary([]);
const emptyComparison: ReportsComparison = {
  revenue: { label: "—", tone: "neutral" },
  orders: { label: "—", tone: "neutral" },
  averageOrderValue: { label: "—", tone: "neutral" },
  itemsSold: { label: "—", tone: "neutral" },
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function RankListItem({
  rank,
  title,
  subtitle,
  value,
}: {
  rank: number;
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          <span className="mr-1.5 text-xs text-muted-foreground">#{rank}</span>
          {title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-primary">{value}</p>
    </li>
  );
}

export function ReportsPage() {
  const [range, setRange] = useState<ReportDateRange>("30d");
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function refresh() {
      setOrders(loadReportOrders());
      setMounted(true);
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, []);

  const filteredOrders = useMemo(() => filterOrdersByRange(orders, range), [orders, range]);
  const previousOrders = useMemo(
    () => filterOrdersByPreviousRange(orders, range),
    [orders, range]
  );

  const summary = useMemo(
    () => (mounted ? getReportsSummary(filteredOrders) : emptySummary),
    [filteredOrders, mounted]
  );
  const previousSummary = useMemo(
    () => (mounted ? getReportsSummary(previousOrders) : emptySummary),
    [previousOrders, mounted]
  );
  const comparison = useMemo(
    () => (mounted ? getReportsComparison(summary, previousSummary) : emptyComparison),
    [summary, previousSummary, mounted]
  );

  const trend = useMemo(
    () => (mounted ? getRevenueTrend(orders, range) : []),
    [orders, range, mounted]
  );
  const statusBreakdown = useMemo(
    () => (mounted ? getStatusBreakdown(filteredOrders) : []),
    [filteredOrders, mounted]
  );
  const paymentBreakdown = useMemo(
    () => (mounted ? getPaymentBreakdown(filteredOrders) : []),
    [filteredOrders, mounted]
  );
  const topProducts = useMemo(
    () => (mounted ? getTopProducts(filteredOrders, 6) : []),
    [filteredOrders, mounted]
  );
  const topCustomers = useMemo(
    () => (mounted ? getTopCustomers(filteredOrders, 6) : []),
    [filteredOrders, mounted]
  );
  const cities = useMemo(
    () => (mounted ? getCityBreakdown(filteredOrders, 6) : []),
    [filteredOrders, mounted]
  );
  const coupons = useMemo(
    () => (mounted ? getCouponBreakdown(filteredOrders, 6) : []),
    [filteredOrders, mounted]
  );
  const recentOrders = useMemo(
    () => (mounted ? getRecentReportOrders(filteredOrders, 6) : []),
    [filteredOrders, mounted]
  );

  const maxRevenue = Math.max(...trend.map((item) => item.revenue), 1);
  const hasTrendData = trend.some((item) => item.revenue > 0 || item.orders > 0);
  const rangeLabel =
    rangeOptions.find((option) => option.value === range)?.label ?? "Selected range";
  const showComparison = range !== "all";

  function handleExport() {
    exportReportsCsv(
      summary,
      topProducts,
      topCustomers,
      cities,
      coupons,
      paymentBreakdown,
      range
    );
    toast.success("Full report exported to CSV");
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Reports"
        description={rangeLabel}
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <AdminSelect
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
              value={range}
              onChange={(event) => setRange(event.target.value as ReportDateRange)}
              aria-label="Report date range"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
            <Button variant="bakery" className="shrink-0" onClick={handleExport}>
              <Download className="size-4" />
              <span className="sm:hidden">Export</span>
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <DashboardStatCard
          title="Revenue"
          value={formatCurrency(summary.revenue)}
          change={showComparison ? comparison.revenue.label : "All-time total"}
          changeTone={showComparison ? comparison.revenue.tone : "neutral"}
          icon={IndianRupee}
          tone="gold"
        />
        <DashboardStatCard
          title="Orders"
          value={summary.orders}
          change={showComparison ? comparison.orders.label : "All-time total"}
          changeTone={showComparison ? comparison.orders.tone : "neutral"}
          icon={ShoppingBag}
          tone="bakery"
          href={routes.admin.orders.list}
        />
        <DashboardStatCard
          title="Avg. order"
          value={formatCurrency(summary.averageOrderValue)}
          change={showComparison ? comparison.averageOrderValue.label : "All-time average"}
          changeTone={showComparison ? comparison.averageOrderValue.tone : "neutral"}
          icon={BarChart3}
          tone="neutral"
        />
        <DashboardStatCard
          title="Items sold"
          value={summary.itemsSold}
          change={showComparison ? comparison.itemsSold.label : "All-time total"}
          changeTone={showComparison ? comparison.itemsSold.tone : "neutral"}
          icon={Package}
          tone="bakery"
        />
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <Card className="flex h-full flex-col shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue trend</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col pt-0">
              <div className="flex flex-1 flex-col overflow-x-auto rounded-xl border border-dashed border-border bg-muted/50 p-3 sm:p-4">
                {!hasTrendData ? (
                  <div className="flex flex-1 items-center justify-center py-10">
                    <p className="text-sm text-muted-foreground">No sales data yet</p>
                  </div>
                ) : (
                  <div
                    className="grid h-36 gap-1 sm:h-44 sm:gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(trend.length, 1)}, minmax(${trend.length > 14 ? "18px" : "0"}, 1fr))`,
                      minWidth: trend.length > 14 ? `${trend.length * 22}px` : undefined,
                    }}
                  >
                    {trend.map((item, index) => {
                      const height = Math.max(8, Math.round((item.revenue / maxRevenue) * 100));
                      const isLatest = index === trend.length - 1;
                      const showLabel =
                        trend.length <= 8 ||
                        index === 0 ||
                        index === trend.length - 1 ||
                        index % Math.ceil(trend.length / 6) === 0;

                      return (
                        <div
                          key={`${item.label}-${index}`}
                          className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"
                        >
                          <div className="flex h-full w-full items-end">
                            <div
                              className="w-full rounded-sm bg-gold-200 data-[active=true]:bg-gold-500"
                              data-active={isLatest}
                              style={{ height: `${height}%` }}
                              title={`${item.label}: ${formatCurrency(item.revenue)} · ${item.orders} orders`}
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
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-4">
          <Card className="flex h-full flex-col shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="min-w-0 truncate text-base">Order status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col pt-0">
              {statusBreakdown.length === 0 ? (
                <EmptyState message="No orders in this range" />
              ) : (
                <ul className="divide-y divide-border">
                  {statusBreakdown.map((item) => (
                    <li
                      key={item.status}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <AdminOrderStatusBadge status={item.status} />
                      <div className="text-right text-sm">
                        <p className="font-medium">{item.count}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.revenue)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex h-full flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pt-0">
            <div className="grid grid-cols-2 gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">COD</p>
                <p className="mt-0.5 font-heading text-lg font-semibold">{summary.codOrders}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Prepaid</p>
                <p className="mt-0.5 font-heading text-lg font-semibold">{summary.prepaidOrders}</p>
              </div>
            </div>
            {paymentBreakdown.length === 0 ? (
              <EmptyState message="No payment data" />
            ) : (
              <div className="space-y-3">
                {paymentBreakdown.map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{item.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.count} · {formatCurrency(item.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round((item.revenue / Math.max(summary.revenue, 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fulfillment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            <div className="grid flex-1 grid-cols-2 content-start gap-2">
              {[
                { label: "Delivered", value: summary.delivered, tone: "text-green-700 dark:text-green-400" },
                { label: "Active", value: summary.activeOrders, tone: "text-primary" },
                { label: "Cancelled", value: summary.cancelled, tone: "text-destructive" },
                { label: "Refunded", value: summary.refunded, tone: "text-amber-700 dark:text-amber-400" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border bg-muted/80 px-3 py-3"
                >
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className={cn("mt-1 font-heading text-xl font-semibold", item.tone)}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col shadow-sm md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top cities</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            {cities.length === 0 ? (
              <EmptyState message="No city data" />
            ) : (
              <ul className="divide-y divide-border">
                {cities.map((city, index) => (
                  <RankListItem
                    key={city.city}
                    rank={index + 1}
                    title={city.city}
                    subtitle={`${city.orders} orders`}
                    value={formatCurrency(city.revenue)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex h-full flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top products</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            {topProducts.length === 0 ? (
              <EmptyState message="No product sales" />
            ) : (
              <ul className="divide-y divide-border">
                {topProducts.map((product, index) => (
                  <RankListItem
                    key={product.slug}
                    rank={index + 1}
                    title={product.name}
                    subtitle={`${product.quantity} sold`}
                    value={formatCurrency(product.revenue)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top customers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0">
            {topCustomers.length === 0 ? (
              <EmptyState message="No customer orders" />
            ) : (
              <ul className="divide-y divide-border">
                {topCustomers.map((customer, index) => (
                  <RankListItem
                    key={customer.email}
                    rank={index + 1}
                    title={customer.name}
                    subtitle={`${customer.orders} orders · ${customer.email}`}
                    value={formatCurrency(customer.revenue)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col shadow-sm md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coupons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 pt-0">
            <div className="border-b border-border pb-3">
              <p className="text-[11px] text-muted-foreground">Total savings</p>
              <p className="mt-0.5 font-heading text-lg font-semibold">
                {formatCurrency(summary.couponDiscount)}
              </p>
            </div>
            {coupons.length === 0 ? (
              <EmptyState message="No coupons used" />
            ) : (
              <ul className="divide-y divide-border">
                {coupons.map((coupon) => (
                  <li
                    key={coupon.code}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{coupon.code}</p>
                      <p className="text-xs text-muted-foreground">{coupon.uses} uses</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-primary">
                      {formatCurrency(coupon.discount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="min-w-0 truncate text-base">Orders in range</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentOrders.length === 0 ? (
              <EmptyState message="No orders in this range" />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Order</th>
                        <th className="pb-2 pr-3 font-medium">Customer</th>
                        <th className="pb-2 pr-3 font-medium">Status</th>
                        <th className="pb-2 pr-3 font-medium">Payment</th>
                        <th className="pb-2 pr-3 font-medium">Placed</th>
                        <th className="pb-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 pr-3">
                            <Link
                              href={routes.admin.orders.detail(order.id)}
                              className="font-medium text-primary hover:underline"
                            >
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="max-w-[160px] py-2.5 pr-3">
                            <p className="truncate">{order.address.fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {order.address.city}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3">
                            <AdminOrderStatusBadge status={order.status} />
                          </td>
                          <td className="py-2.5 pr-3 text-xs capitalize text-muted-foreground">
                            {order.paymentMethod}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">
                            {formatRelativeTime(order.placedAt)}
                          </td>
                          <td className="py-2.5 text-right font-semibold">
                            {formatCurrency(order.totals.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-border lg:hidden">
                  {recentOrders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={routes.admin.orders.detail(order.id)}
                        className="flex items-start justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {order.orderNumber}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.address.fullName} · {formatRelativeTime(order.placedAt)}
                          </p>
                          <div className="mt-1.5">
                            <AdminOrderStatusBadge status={order.status} />
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatCurrency(order.totals.total)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </AdminPage>
  );
}
