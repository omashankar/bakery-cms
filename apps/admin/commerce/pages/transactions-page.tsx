"use client";

import { useEffect, useState } from "react";
import { Download, IndianRupee, Loader2, Receipt, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { type FiguresState } from "@/components/shared/panel-loading";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import {
  fetchOrder,
  fetchTransactionsPage,
  type TransactionsOverviewResponse,
} from "@/features/orders/lib/orders-api";
import {
  defaultTransactionFilters,
  exportTransactionsToCsv,
  type TransactionFilters,
  type TransactionView,
} from "@/features/payments/lib/transactions";
import { PaymentStatusBadge } from "@/features/payments/components/payment-status-badge";
import { GatewayLogo } from "@/features/payments/components/gateway-logo";
import { getGatewayConfig, PAYMENT_GATEWAYS } from "@/features/payments/registry/gateways";
import { TransactionDetailDialog } from "@/apps/admin/commerce/components/transaction-detail-dialog";
import { FilterPanel, FilterPanelSearch } from "@/apps/admin/components/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { reportedAsSignedOut, reportedAsSignedOutOnRead } from "@/apps/admin/lib/report-write";

const PAGE_SIZE = 12;
/** Matches the server's max page size — one request, no client-side paging loop. */
const EXPORT_LIMIT = 500;

const EMPTY_TRANSACTIONS_OVERVIEW: TransactionsOverviewResponse = {
  filteredVolume: 0,
  filteredSuccessCount: 0,
  totalRecords: 0,
};

export function TransactionsPage() {
  const [paginated, setPaginated] = useState<TransactionView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /**
   * The three states these cards have, rather than the one they assumed.
   *
   * Each renders its zeroed EMPTY_* constant with no gate, so a cold load
   * stated "Pending amount ₹0.00 — All clear" in green, "Volume ₹0.00 · all
   * time" and "Paid 0 · all time" as the shop's figures — and a FAILED load
   * left them standing. The loading and failed flags were already here; they
   * simply never reached the cards. Same wiring as the dashboard and reports.
   */
  const statFigures: FiguresState = loading ? "loading" : failed ? "unavailable" : "ready";
  const [overview, setOverview] = useState<TransactionsOverviewResponse>(EMPTY_TRANSACTIONS_OVERVIEW);
  const [filters, setFilters] = useState<TransactionFilters>(defaultTransactionFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PlacedOrder | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  // Rows AND figures from one server pass over every order. A transaction's
  // status group and gateway are derived from the order rather than stored, so
  // this cannot be a plain indexed query — but it also cannot be the browser
  // cache, which only ever holds the most recent slice of orders.
  // One debounced key for filters AND page. The search box is undebounced
  // and each request filters the whole orders collection server-side, so
  // keying the fetch straight off the input turned a six-letter name into
  // six full-collection queries, five of them already stale on arrival.
  // The request uses the CLAMPED page. Filters or a mutation can shrink the
  // result set under the page the admin is on; asking for the raw page then
  // returns nothing and hides the pager, stranding them with no way back.
  const requestKey = useDebouncedValue(
    JSON.stringify({ filters, page: currentPage }),
    250
  );
  const request = JSON.parse(requestKey) as {
    filters: Record<string, unknown>;
    page: number;
  };
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Re-armed on EVERY request, not just the first: without this a refilter
      // asserts "none found" over the old empty list while the new one loads.
      setLoading(true);
      const result = await fetchTransactionsPage({ ...request.filters, page: request.page, limit: PAGE_SIZE });
      if (cancelled) return;
      if (result) {
        setPaginated(result.items);
        setTotal(result.total);
        setOverview(result.overview);
      }
      setFailed(!result);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  function updateFilters(patch: Partial<TransactionFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  /** The dialog wants the whole order, which the transaction row does not carry. */
  async function openDetail(orderId: string) {
    const order = await fetchOrder(orderId);
    if (order) {
      setSelected(order);
      return;
    }
    // Silently doing nothing reads as a broken row; with an expired session that
    // is every row on the page.
    if (!reportedAsSignedOutOnRead()) toast.error("Could not load that order", {
      description: "The server did not answer — reload and try again.",
    });
  }

  async function handleExport() {
    // `total` is 0 after a FAILED load too, and telling the admin the shop has
    // no transactions is a different claim from admitting the list never arrived.
    // orders-list and invoices already make this distinction.
    if (failed) {
      if (!reportedAsSignedOutOnRead()) toast.error("Could not load the transactions to export", {
        description: "The server did not answer — reload and try again.",
      });
      return;
    }
    if (total === 0) {
      toast.error("No transactions to export");
      return;
    }

    // The page holds PAGE_SIZE rows, so exporting the whole filtered set means
    // asking the server for it rather than writing out what happens to be visible.
    const result = await fetchTransactionsPage({
      ...filters,
      page: 1,
      limit: Math.min(total, EXPORT_LIMIT),
    });
    if (!result || result.items.length === 0) {
      toast.error("Could not load transactions to export");
      return;
    }

    exportTransactionsToCsv(result.items);

    if (total > EXPORT_LIMIT) {
      toast.warning(`Exported the newest ${EXPORT_LIMIT} of ${total} transactions`, {
        description: "Narrow the filters to export the rest.",
      });
      return;
    }

    toast.success(
      `Exported ${result.items.length} transaction${result.items.length === 1 ? "" : "s"}`
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Transactions"
        description="Every payment across gateways, methods and statuses."
        actions={
          <Button variant="bakery" onClick={handleExport} className="w-full sm:w-auto">
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <DashboardStatCard
          title="Volume"
          value={formatCurrency(overview.filteredVolume)}
          change={`${total} transactions`}
          icon={IndianRupee}
          tone="bakery"
          figures={statFigures}
        />
        <DashboardStatCard
          title="Successful"
          value={String(overview.filteredSuccessCount)}
          change="captured / paid"
          icon={TrendingUp}
          tone="gold"
          figures={statFigures}
        />
        <DashboardStatCard
          title="Total records"
          value={String(overview.totalRecords)}
          change="all time"
          icon={Receipt}
          tone="neutral"
          figures={statFigures}
        />
      </section>

      <FilterPanel>
        <div className="space-y-3">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search txn id, order, customer, reference…"
          />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <AdminSelect
              value={filters.gateway}
              onChange={(e) => updateFilters({ gateway: e.target.value })}
              aria-label="Gateway"
            >
              <option value="all">All gateways</option>
              {PAYMENT_GATEWAYS.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={filters.method}
              onChange={(e) => updateFilters({ method: e.target.value })}
              aria-label="Method"
            >
              <option value="all">All methods</option>
              <option value="razorpay">Online</option>
              <option value="cod">COD</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </AdminSelect>
            <AdminSelect
              value={filters.statusGroup}
              onChange={(e) => updateFilters({ statusGroup: e.target.value as TransactionFilters["statusGroup"] })}
              aria-label="Status"
            >
              <option value="all">All statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refund">Refund</option>
              <option value="cod">COD</option>
            </AdminSelect>
            <AdminSelect
              value={filters.dateRange}
              onChange={(e) => updateFilters({ dateRange: e.target.value as TransactionFilters["dateRange"] })}
              aria-label="Date range"
            >
              <option value="all">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </AdminSelect>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Min ₹"
                value={filters.minAmount}
                onChange={(e) => updateFilters({ minAmount: e.target.value })}
                className="h-10"
              />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Max ₹"
                value={filters.maxAmount}
                onChange={(e) => updateFilters({ maxAmount: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
        </div>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {paginated.length === 0 && loading ? (
          // Asserting there are none before the server has answered is a
          // guess, and a wrong one on every cold load in a shop that has them.
          <div className="relative flex min-h-48 items-center justify-center py-14">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading transactions</span>
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={failed ? "Could not load transactions" : "No transactions found"}
            description="Adjust the filters, or place a checkout order."
            className="py-14"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Transaction</th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Gateway</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((t) => {
                    return (
                      <tr
                        key={t.orderId}
                        onClick={() => void openDetail(t.orderId)}
                        className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{t.id}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.orderNumber}</td>
                        <td className="max-w-[180px] px-4 py-3">
                          <p className="truncate">{t.customerName}</p>
                          <p className="truncate text-xs text-muted-foreground">{t.customerEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <GatewayLogo mark={getGatewayConfig(t.gatewayId)?.mark ?? "?"} size="sm" />
                            <span>{t.gatewayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(t.amount)}</td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {formatRelativeTime(t.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border lg:hidden">
              {paginated.map((t) => {
                return (
                  <li key={t.orderId}>
                    <button
                      type="button"
                      onClick={() => void openDetail(t.orderId)}
                      className="w-full p-3 text-left sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{t.id}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.orderNumber} · {t.customerName}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">{formatCurrency(t.amount)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <PaymentStatusBadge status={t.status} />
                        <span className="text-xs text-muted-foreground">
                          {t.gatewayName} · {formatRelativeTime(t.createdAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
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

      <TransactionDetailDialog
        order={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </AdminPage>
  );
}
