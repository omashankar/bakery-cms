"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  IndianRupee,
  Package,
  Send,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/products/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { AdminOrderStatusBadge } from "@/features/admin/commerce/components/admin-order-status-badge";
import { AdminPaymentStatusBadge } from "@/features/admin/commerce/components/admin-payment-status-badge";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import {
  defaultOrderFilters,
  ensureDemoOrders,
  exportOrdersToCsv,
  filterOrders,
  getOrderStats,
  type OrderListFilters,
} from "@/features/admin/commerce/lib/order-utils";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import {
  bulkUpdateOrderStatus,
  getOrders,
  type OrderStatus,
  type PlacedOrder,
} from "@/features/orders/lib/orders";
import { getActiveFulfillmentStatuses } from "@/features/orders/lib/order-tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 10;

const EMPTY_STATS = {
  total: 0,
  pending: 0,
  confirmed: 0,
  preparing: 0,
  ready: 0,
  outForDelivery: 0,
  delivered: 0,
  cancelled: 0,
  refunded: 0,
  revenue: 0,
};

const statusTabs: Array<{ value: OrderListFilters["status"]; label: string; short: string }> = [
  { value: "all", label: "All", short: "All" },
  { value: "pending", label: "Pending", short: "Pending" },
  { value: "confirmed", label: "Confirmed", short: "Confirm" },
  { value: "preparing", label: "Preparing", short: "Prep" },
  { value: "ready", label: "Ready", short: "Ready" },
  { value: "out_for_delivery", label: "Out for delivery", short: "Delivery" },
  { value: "delivered", label: "Delivered", short: "Done" },
  { value: "cancelled", label: "Cancelled", short: "Cancel" },
  { value: "refunded", label: "Refunded", short: "Refund" },
];

export function OrdersListPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [filters, setFilters] = useState<OrderListFilters>(defaultOrderFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("preparing");

  useEffect(() => {
    ensureDemoOrders();
    setOrders(getOrders());
    setMounted(true);

    function refresh() {
      setOrders(getOrders());
    }

    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, []);

  const filtered = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const stats = useMemo(
    () => (mounted ? getOrderStats(orders) : EMPTY_STATS),
    [orders, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const inProgress =
    stats.pending +
    stats.confirmed +
    stats.preparing +
    stats.ready +
    stats.outForDelivery;

  const pageIds = paginated.map((order) => order.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function updateFilters(patch: Partial<OrderListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
  }

  function countForStatus(status: OrderListFilters["status"]) {
    if (status === "all") return orders.length;
    return orders.filter((order) => order.status === status).length;
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  function handleBulkStatusUpdate() {
    if (selectedIds.length === 0) return;
    const count = bulkUpdateOrderStatus(selectedIds, bulkStatus);
    setSelectedIds([]);
    setOrders(getOrders());
    toast.success(`Updated ${count} order${count === 1 ? "" : "s"}`);
  }

  function handleExport() {
    const target =
      selectedIds.length > 0
        ? orders.filter((order) => selectedIds.includes(order.id))
        : filtered;
    if (target.length === 0) {
      toast.error("No orders to export");
      return;
    }
    exportOrdersToCsv(target);
    toast.success(`Exported ${target.length} order${target.length === 1 ? "" : "s"}`);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Orders"
        description="Track and fulfill customer orders."
        className="gap-3"
        actions={
          <Button variant="bakery" className="w-full sm:w-auto" onClick={handleExport}>
            <Download className="size-4" />
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() =>
            updateFilters({
              status: "all",
              deliveryStatus: "all",
              search: "",
            })
          }
        >
          <DashboardStatCard
            title="Total orders"
            value={stats.total}
            change="All orders"
            changeTone="neutral"
            icon={ShoppingBag}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() =>
            updateFilters({
              status: "all",
              deliveryStatus: "in_progress",
            })
          }
        >
          <DashboardStatCard
            title="In progress"
            value={inProgress}
            change={inProgress > 0 ? "Needs fulfillment" : "All clear"}
            changeTone={inProgress > 0 ? "warning" : "positive"}
            icon={Send}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() =>
            updateFilters({
              status: "delivered",
              deliveryStatus: "all",
            })
          }
        >
          <DashboardStatCard
            title="Delivered"
            value={stats.delivered}
            change="Completed orders"
            changeTone="positive"
            icon={CheckCircle2}
            tone="bakery"
          />
        </button>
        <DashboardStatCard
          title="Revenue"
          value={formatCurrency(stats.revenue)}
          change="Excludes cancelled"
          changeTone="neutral"
          icon={IndianRupee}
          tone="gold"
        />
      </section>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1.5 pb-0.5">
          {statusTabs.map((tab) => {
            const active = filters.status === tab.value;
            return (
              <Button
                key={tab.value}
                size="sm"
                variant={active ? "bakery" : "outline"}
                onClick={() =>
                  updateFilters({
                    status: tab.value,
                    deliveryStatus: "all",
                  })
                }
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              >
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.short}</span>
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className={cn(
                    "h-5 min-w-5 justify-center px-1.5 text-[10px]",
                    active && "border-transparent bg-primary-foreground/20 text-primary-foreground"
                  )}
                >
                  {countForStatus(tab.value)}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      <FilterPanel>
        <FilterPanelToolbar className="gap-2.5 sm:flex-row sm:items-center">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search order, customer, email…"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <AdminSelect
              className="w-full sm:w-36"
              value={filters.payment}
              onChange={(event) =>
                updateFilters({
                  payment: event.target.value as OrderListFilters["payment"],
                })
              }
              aria-label="Payment filter"
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="cod">COD</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-36"
              value={filters.dateRange}
              onChange={(event) =>
                updateFilters({
                  dateRange: event.target.value as OrderListFilters["dateRange"],
                })
              }
              aria-label="Date range"
            >
              <option value="all">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <AdminSelect
                className="w-full sm:w-44"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as OrderStatus)}
                aria-label="Bulk status"
              >
                {getActiveFulfillmentStatuses().map((status) => (
                  <option key={status} value={status}>
                    Mark {status.replace(/_/g, " ")}
                  </option>
                ))}
              </AdminSelect>
              <Button size="sm" variant="outline" onClick={handleBulkStatusUpdate}>
                Apply
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport}>
                Export
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {paginated.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders found"
            description="Try another filter, or wait for new checkout orders."
            className="py-14"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleSelectPage}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border/70 transition-colors hover:bg-muted"
                    >
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                          aria-label={`Select ${order.orderNumber}`}
                        />
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3 font-medium text-foreground"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        {order.orderNumber}
                      </td>
                      <td
                        className="max-w-[180px] cursor-pointer px-4 py-3"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        <p className="truncate">{order.address.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.address.email}
                        </p>
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        {order.items.length}
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3 font-semibold"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        {formatCurrency(order.totals.total)}
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        <AdminOrderStatusBadge status={order.status} />
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        <AdminPaymentStatusBadge status={order.paymentStatus} />
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3 text-muted-foreground"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        {formatRelativeTime(order.placedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border lg:hidden">
              {paginated.map((order) => (
                <li key={order.id} className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.includes(order.id)}
                      onCheckedChange={() => toggleSelect(order.id)}
                      aria-label={`Select ${order.orderNumber}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(routes.admin.orders.detail(order.id))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {order.orderNumber}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.address.fullName} · {formatRelativeTime(order.placedAt)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatCurrency(order.totals.total)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <AdminOrderStatusBadge status={order.status} />
                        <AdminPaymentStatusBadge status={order.paymentStatus} />
                        <span className="text-xs text-muted-foreground">
                          {order.items.length} item{order.items.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border px-3 py-3 sm:px-4">
              <ListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </section>
    </AdminPage>
  );
}
