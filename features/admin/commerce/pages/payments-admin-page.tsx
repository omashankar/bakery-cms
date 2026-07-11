"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Download,
  IndianRupee,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { AdminPaymentStatusBadge } from "@/features/admin/commerce/components/admin-payment-status-badge";
import { ensureDemoOrders } from "@/features/admin/commerce/lib/order-utils";
import {
  defaultPaymentFilters,
  EMPTY_PAYMENT_OVERVIEW,
  exportPaymentsToCsv,
  filterPaymentOrders,
  getPaymentOverview,
  paymentMethodLabels,
  type PaymentListFilters,
} from "@/features/admin/commerce/lib/payment-utils";
import { useCommerceSettingsForm } from "@/features/admin/commerce/lib/use-commerce-settings-form";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";
import {
  bulkUpdatePaymentStatus,
  getOrders,
  type PaymentStatus,
  type PlacedOrder,
} from "@/features/storefront/checkout/lib/orders";
import { formatCurrency, formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 10;

const methodOptions = [
  {
    key: "cod" as const,
    label: "Cash on Delivery",
    description: "Customer pays when the order is delivered.",
    icon: Wallet,
  },
  {
    key: "upi" as const,
    label: "UPI",
    description: "Demo UPI checkout screen with QR placeholder.",
    icon: IndianRupee,
  },
  {
    key: "card" as const,
    label: "Card",
    description: "Demo card form for credit and debit payments.",
    icon: CreditCard,
  },
];

export function PaymentsAdminPage() {
  const router = useRouter();
  const { settings, setSettings, isDirty, save } = useCommerceSettingsForm();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [filters, setFilters] = useState<PaymentListFilters>(defaultPaymentFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<PaymentStatus>("paid");

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

  const filtered = useMemo(() => filterPaymentOrders(orders, filters), [orders, filters]);
  const overview = useMemo(
    () => (mounted ? getPaymentOverview(orders) : EMPTY_PAYMENT_OVERVIEW),
    [orders, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageIds = paginated.map((order) => order.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const enabledCount = [
    settings.paymentMethods.cod,
    settings.paymentMethods.upi,
    settings.paymentMethods.card,
  ].filter(Boolean).length;

  function updateFilters(patch: Partial<PaymentListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
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
    const count = bulkUpdatePaymentStatus(selectedIds, bulkStatus);
    setSelectedIds([]);
    setOrders(getOrders());
    toast.success(`Updated ${count} payment${count === 1 ? "" : "s"}`);
  }

  function handleExport() {
    const target =
      selectedIds.length > 0
        ? orders.filter((order) => selectedIds.includes(order.id))
        : filtered;
    if (target.length === 0) {
      toast.error("No payments to export");
      return;
    }
    exportPaymentsToCsv(target);
    toast.success(`Exported ${target.length} payment${target.length === 1 ? "" : "s"}`);
  }

  function toggleMethod(key: "cod" | "upi" | "card", checked: boolean) {
    if (!checked && enabledCount <= 1 && settings.paymentMethods[key]) {
      toast.error("Keep at least one payment method enabled");
      return;
    }
    setSettings((prev) => ({
      ...prev,
      paymentMethods: { ...prev.paymentMethods, [key]: checked },
    }));
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Payments"
        description="Checkout payments and method settings."
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="bakery" className="w-full sm:w-auto" onClick={handleExport}>
              <Download className="size-4" />
              <span className="sm:hidden">Export</span>
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", method: "all", search: "" })}
        >
          <DashboardStatCard
            title="Collected"
            value={formatCurrency(overview.collected)}
            change={
              overview.outstanding > 0
                ? `${formatCurrency(overview.outstanding)} outstanding`
                : "Paid + delivered COD"
            }
            changeTone={overview.outstanding > 0 ? "warning" : "positive"}
            icon={IndianRupee}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "pending" })}
        >
          <DashboardStatCard
            title="Pending"
            value={overview.pending}
            change={overview.pending > 0 ? "Awaiting payment" : "All clear"}
            changeTone={overview.pending > 0 ? "warning" : "positive"}
            icon={AlertTriangle}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "failed" })}
        >
          <DashboardStatCard
            title="Failed"
            value={overview.failed}
            change={overview.failed > 0 ? "Needs follow-up" : "None"}
            changeTone={overview.failed > 0 ? "warning" : "positive"}
            icon={AlertTriangle}
            tone="neutral"
          />
        </button>
      </section>

      <FilterPanel>
        <div className="space-y-3">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search order, customer, reference…"
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <AdminSelect
              value={filters.status}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as PaymentListFilters["status"],
                })
              }
              aria-label="Payment status"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="cod">COD</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </AdminSelect>
            <AdminSelect
              value={filters.method}
              onChange={(event) =>
                updateFilters({
                  method: event.target.value as PaymentListFilters["method"],
                })
              }
              aria-label="Payment method"
            >
              <option value="all">All methods</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="cod">COD</option>
            </AdminSelect>
            <AdminSelect
              className="col-span-2 md:col-span-1"
              value={filters.dateRange}
              onChange={(event) =>
                updateFilters({
                  dateRange: event.target.value as PaymentListFilters["dateRange"],
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
        </div>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <AdminSelect
                className="w-full sm:w-40"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as PaymentStatus)}
                aria-label="Bulk payment status"
              >
                <option value="paid">Mark paid</option>
                <option value="pending">Mark pending</option>
                <option value="failed">Mark failed</option>
                <option value="cod">Mark COD</option>
              </AdminSelect>
              <Button size="sm" variant="outline" onClick={handleBulkStatusUpdate}>
                Apply
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport}>
                Export
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {paginated.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="No payments found"
            description="Try another filter, or place a checkout order."
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
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
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
                        {paymentMethodLabels[order.paymentMethod]}
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
                        {order.paymentReference ?? "—"}
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3 font-semibold"
                        onClick={() => router.push(routes.admin.orders.detail(order.id))}
                      >
                        {formatCurrency(order.totals.total)}
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
                        <AdminPaymentStatusBadge status={order.paymentStatus} />
                        <span className="text-xs text-muted-foreground">
                          {paymentMethodLabels[order.paymentMethod]}
                        </span>
                        {order.paymentReference ? (
                          <span className="text-xs text-muted-foreground">
                            · {order.paymentReference}
                          </span>
                        ) : null}
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

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Checkout methods</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {enabledCount} enabled · demo UI only (no real gateway)
            </p>
          </div>
          <Button
            variant="bakery"
            className="w-full sm:w-auto"
            disabled={!isDirty}
            onClick={() => save("Payment methods saved")}
          >
            Save methods
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {methodOptions.map((method) => {
            const Icon = method.icon;
            const checked = settings.paymentMethods[method.key];
            const isLastEnabled = checked && enabledCount <= 1;
            return (
              <div
                key={method.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                </div>
                <Switch
                  checked={checked}
                  disabled={isLastEnabled}
                  onCheckedChange={(next) => toggleMethod(method.key, next)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
