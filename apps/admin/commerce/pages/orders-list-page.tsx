"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  IndianRupee,
  Loader2,
  Package,
  Send,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { isTerminalOrderStatus } from "@/features/orders/lib/order-status-meta";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { AdminOrderStatusBadge } from "@/apps/admin/commerce/components/admin-order-status-badge";
import { AdminPaymentStatusBadge } from "@/apps/admin/commerce/components/admin-payment-status-badge";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { type FiguresState } from "@/components/shared/panel-loading";
import {
  defaultOrderFilters,
  exportOrdersToCsv,
  type OrderListFilters,
} from "@/apps/admin/commerce/lib/order-utils";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import {
  bulkUpdateOrderStatus,
  type OrderStatus,
  type PlacedOrder,
} from "@/features/orders/lib/orders";
import { fetchOrderStats, fetchOrdersPage } from "@/features/orders/lib/orders-api";
import { getActiveFulfillmentStatuses } from "@/features/orders/lib/order-tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 10;
/** Matches the server's max page size — one request, no client-side paging loop. */
const EXPORT_LIMIT = 500;

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
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [filters, setFilters] = useState<OrderListFilters>(defaultOrderFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("preparing");
  const [applying, setApplying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsFailed, setStatsFailed] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [totalMatching, setTotalMatching] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useMemo(
    () => ({
      status: filters.status === "all" ? undefined : filters.status,
      paymentStatus: filters.payment === "all" ? undefined : filters.payment,
      deliveryStatus: filters.deliveryStatus === "all" ? undefined : filters.deliveryStatus,
      dateRange: filters.dateRange === "all" ? undefined : filters.dateRange,
      search: filters.search.trim() || undefined,
      amountMin: filters.amountMin.trim() ? Number(filters.amountMin) : undefined,
      amountMax: filters.amountMax.trim() ? Number(filters.amountMax) : undefined,
    }),
    [filters]
  );

  // The list is server-filtered and server-paginated: the localStorage cache
  // only ever holds the most recent slice, so filtering it would hide older
  // orders entirely and undercount every total.
  // One debounced key for filters AND page. The search box is undebounced
  // and each request filters the whole orders collection server-side, so
  // keying the fetch straight off the input turned a six-letter name into
  // six full-collection queries, five of them already stale on arrival.
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // The request uses the CLAMPED page. Filters or a mutation can shrink the
  // result set under the page the admin is on; asking for the raw page then
  // returns nothing and hides the pager, stranding them with no way back.
  const liveKey = JSON.stringify({ filters: query, page: currentPage });
  const requestKey = useDebouncedValue(liveKey, 250);
  const request = JSON.parse(requestKey) as {
    filters: Record<string, unknown>;
    page: number;
  };
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const result = await fetchOrdersPage({ ...request.filters, page: request.page, limit: PAGE_SIZE });
      if (cancelled) return;
      if (result) {
        setOrders(result.items);
        setTotalMatching(result.pagination?.total ?? result.items.length);
      }
      setFailed(!result);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey, reloadKey]);

  // Counts and revenue come from a Mongo aggregation over every order, so they
  // stay right regardless of how many rows this page happens to show.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const summary = await fetchOrderStats();
      if (cancelled) return;
      // EMPTY_STATS would otherwise render as a confident "0 orders, ₹0" — the
      // one reading an admin must never get from a request that simply failed.
      setStatsFailed(!summary);
      if (summary) setStats(summary);
      setStatsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const paginated = orders;

  // `loading` is re-armed only when the DEBOUNCED key changes, so for the first
  // 250ms after a keystroke the fetch has not started yet and the old, already
  // wrong result is still on screen — asserted as "No orders found" rather than
  // shown as pending. A request the admin has already caused counts as in flight.
  const pending = loading || requestKey !== liveKey;

  /**
   * Cards must read "unavailable", not zero, when the aggregation did not
   * answer — and must say nothing at all until it has.
   *
   * `statsFailed` knew failure from success and counted "has not answered yet"
   * as success, so a cold load printed nine confident zeros and captioned "In
   * progress 0" as "All clear" in green: the sentence that tells a baker there
   * is nothing waiting to be made.
   */
  const statFigures: FiguresState = !statsLoaded
    ? "loading"
    : statsFailed
      ? "unavailable"
      : "ready";
  const statValue = (value: string | number) => (statsFailed ? "—" : value);
  const statChange = (change: string) => (statsFailed ? "Unavailable" : change);
  const statTone = <T,>(tone: T) => (statsFailed ? ("warning" as const) : tone);

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

  /**
   * The badge on a status tab, or "—" when the aggregation did not answer.
   *
   * The cards above these tabs already read "Unavailable" in that case; the tabs
   * were still rendering nine confident zeros from the same failed payload —
   * "All 0", "Pending 0", "Delivered 0" — directly above ten visible orders.
   */
  function countForStatus(status: OrderListFilters["status"]): string | number {
    if (statFigures !== "ready") return "—";
    if (status === "all") return stats.total;
    if (status === "out_for_delivery") return stats.outForDelivery;
    return stats[status];
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

  /**
   * Selected orders whose status this action cannot change.
   *
   * Cancelled and refunded orders have checkboxes like any other row, and the
   * status tabs let an admin filter to exactly those — so select-all here used
   * to write a refunded order back to `delivered`. The server refuses that now;
   * this stops the screen offering it in the first place, and says why.
   */
  const lockedSelection = useMemo(
    () =>
      orders.filter(
        (order) => selectedIds.includes(order.id) && isTerminalOrderStatus(order.status)
      ),
    [orders, selectedIds]
  );

  async function handleBulkStatusUpdate() {
    if (selectedIds.length === 0 || applying || lockedSelection.length > 0) return;

    setApplying(true);
    // Named apart from the `failed` fetch state above — they mean different things.
    const { updated, failed: rejected } = await bulkUpdateOrderStatus(selectedIds, bulkStatus);
    setApplying(false);
    setSelectedIds([]);
    setReloadKey((value) => value + 1);

    if (rejected > 0) {
      toast.error(`${rejected} of ${selectedIds.length} did not reach the server`, {
        description: "Those changes exist on this device only — reload to see the server's version.",
      });
      return;
    }

    toast.success(`Applied to ${updated} order${updated === 1 ? "" : "s"}`);
  }

  /**
   * The exportable slice of the current filters, straight from the server — the
   * page in front of the admin holds only PAGE_SIZE rows. Asked for the full
   * EXPORT_LIMIT rather than `Math.min(totalMatching, …)`, because that count is
   * whatever the last page load reported and the collection moves underneath it.
   */
  function mergeById(first: PlacedOrder[], second: PlacedOrder[]) {
    const byId = new Map(first.map((order) => [order.id, order]));
    for (const order of second) byId.set(order.id, order);
    return [...byId.values()];
  }

  async function loadForExport() {
    setExporting(true);
    // The DEBOUNCED filters, matching the rows on screen and the count beside
    // them — not the live inputs, which may be a keystroke ahead of both.
    const result = await fetchOrdersPage({ ...request.filters, page: 1, limit: EXPORT_LIMIT });
    setExporting(false);
    return result;
  }

  async function handleExport() {
    if (exporting) return;

    if (selectedIds.length > 0) {
      const onThisPage = orders.filter((order) => selectedIds.includes(order.id));

      // A selection SURVIVES paging — only a filter change or Clear resets it —
      // so it routinely covers rows the current page does not hold. Exporting
      // just the visible ones would drop the rest without saying so.
      if (onThisPage.length === selectedIds.length) {
        exportOrdersToCsv(onThisPage);
        toast.success(`Exported ${onThisPage.length} order${onThisPage.length === 1 ? "" : "s"}`);
        return;
      }

      const wider = await loadForExport();
      // Merge rather than replace: the visible rows are already in hand, so a
      // failed or short widening should cost the admin the rows it could not
      // reach — not the ones on screen in front of them.
      const target = mergeById(
        onThisPage,
        (wider?.items ?? []).filter((order) => selectedIds.includes(order.id))
      );
      if (target.length === 0) {
        toast.error("Could not load the selected orders to export");
        return;
      }

      exportOrdersToCsv(target);
      if (target.length < selectedIds.length) {
        // Distinguish "the request failed" from "the range does not reach them".
        // Advising an admin to narrow their filters when the fetch simply 500'd
        // sends them off to solve the wrong problem, and they file the short CSV
        // believing it is the most the range allows.
        toast.warning(`Exported ${target.length} of ${selectedIds.length} selected orders`, {
          description: wider
            ? "The rest fall outside the exportable range — narrow the filters."
            : "The rest could not be loaded. Check your connection and try again.",
        });
        return;
      }
      toast.success(`Exported ${target.length} order${target.length === 1 ? "" : "s"}`);
      return;
    }

    // `totalMatching` is 0 both when there are genuinely no matches and when the
    // page load failed before it ever learned the count. Only the first is a
    // reason to refuse; the second gets the export fetch, which may well work.
    if (totalMatching === 0 && !failed) {
      toast.error("No orders to export");
      return;
    }

    const result = await loadForExport();
    if (!result || result.items.length === 0) {
      toast.error("Could not load orders to export");
      return;
    }

    exportOrdersToCsv(result.items);

    // The server's own count, not the card's — `totalMatching` is from the last
    // page this screen loaded, and orders placed since then would be silently
    // omitted from both the export and the warning about the omission.
    const matched = result.pagination?.total ?? result.items.length;
    if (matched > result.items.length) {
      toast.warning(`Exported the newest ${result.items.length} of ${matched} orders`, {
        description: "Narrow the filters to export the rest.",
      });
      return;
    }

    toast.success(`Exported ${result.items.length} order${result.items.length === 1 ? "" : "s"}`);
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
            value={statValue(stats.total)}
            change={statChange("All orders")}
            changeTone={statTone("neutral" as const)}
            icon={ShoppingBag}
            tone="bakery"
            figures={statFigures}
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
            value={statValue(inProgress)}
            change={statChange(inProgress > 0 ? "Needs fulfillment" : "All clear")}
            changeTone={statTone(inProgress > 0 ? ("warning" as const) : ("positive" as const))}
            icon={Send}
            tone="gold"
            figures={statFigures}
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
            value={statValue(stats.delivered)}
            change={statChange("Completed orders")}
            changeTone={statTone("positive" as const)}
            icon={CheckCircle2}
            tone="bakery"
            figures={statFigures}
          />
        </button>
        <DashboardStatCard
          title="Revenue"
          value={statValue(formatCurrency(stats.revenue))}
          change={statChange("Excludes cancelled")}
          changeTone={statTone("neutral" as const)}
          icon={IndianRupee}
          tone="gold"
          figures={statFigures}
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
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkStatusUpdate}
                disabled={applying || lockedSelection.length > 0}
              >
                {applying ? "Applying..." : "Apply"}
              </Button>
              {lockedSelection.length > 0 ? (
                <span className="text-xs text-destructive">
                  {lockedSelection.length} cancelled or refunded order
                  {lockedSelection.length === 1 ? " is" : "s are"} selected — their status
                  cannot be changed.
                </span>
              ) : null}
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

        {paginated.length === 0 && pending ? (
          // Saying "No orders found" before the server has answered would be a
          // guess, and a wrong one on every cold load in a shop that has orders.
          <div className="flex min-h-48 items-center justify-center py-14">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading orders</span>
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Package}
            title={failed ? "Could not load orders" : "No orders found"}
            description={failed ? "The server did not answer. Check your connection and reload." : "Try another filter, or wait for new checkout orders."}
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
