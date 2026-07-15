"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, IndianRupee, Receipt, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { ensureDemoOrders } from "@/features/admin/commerce/lib/order-utils";
import {
  getOrders,
  type PlacedOrder,
} from "@/features/storefront/checkout/lib/orders";
import {
  applyTransactionFilters,
  buildTransactions,
  defaultTransactionFilters,
  exportTransactionsToCsv,
  type TransactionFilters,
} from "@/features/payments/lib/transactions";
import { PaymentStatusBadge } from "@/features/payments/components/payment-status-badge";
import { GatewayLogo } from "@/features/payments/components/gateway-logo";
import { getGatewayConfig, PAYMENT_GATEWAYS } from "@/features/payments/registry/gateways";
import { TransactionDetailDialog } from "@/features/admin/commerce/components/transaction-detail-dialog";
import { FilterPanel, FilterPanelSearch } from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 12;

export function TransactionsPage() {
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(defaultTransactionFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    ensureDemoOrders();
    setOrders(getOrders());
    setMounted(true);
    const refresh = () => setOrders(getOrders());
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, []);

  const transactions = useMemo(() => buildTransactions(orders), [orders]);
  const filtered = useMemo(
    () => applyTransactionFilters(transactions, filters),
    [transactions, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const volume = mounted ? filtered.reduce((sum, t) => sum + t.amount, 0) : 0;
  const successCount = mounted
    ? filtered.filter((t) => ["captured", "paid", "cod_paid"].includes(t.status)).length
    : 0;

  function updateFilters(patch: Partial<TransactionFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("No transactions to export");
      return;
    }
    exportTransactionsToCsv(filtered);
    toast.success(`Exported ${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`);
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

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <DashboardStatCard
          title="Volume"
          value={formatCurrency(volume)}
          change={`${filtered.length} transactions`}
          icon={IndianRupee}
          tone="bakery"
        />
        <DashboardStatCard
          title="Successful"
          value={String(successCount)}
          change="captured / paid"
          icon={TrendingUp}
          tone="gold"
        />
        <DashboardStatCard
          title="Total records"
          value={String(transactions.length)}
          change="all time"
          icon={Receipt}
          tone="neutral"
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
        {paginated.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions found"
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
                    const order = orders.find((o) => o.id === t.orderId) ?? null;
                    return (
                      <tr
                        key={t.orderId}
                        onClick={() => setSelected(order)}
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
                        <td className="px-4 py-3 text-muted-foreground">
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
                const order = orders.find((o) => o.id === t.orderId) ?? null;
                return (
                  <li key={t.orderId}>
                    <button
                      type="button"
                      onClick={() => setSelected(order)}
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
