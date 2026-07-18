"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  IndianRupee,
  Printer,
  Receipt,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { AdminOrderStatusBadge } from "@/apps/admin/commerce/components/admin-order-status-badge";
import { AdminPaymentStatusBadge } from "@/apps/admin/commerce/components/admin-payment-status-badge";
import { InvoiceDesignPanel } from "@/apps/admin/commerce/components/invoice-design-panel";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import { InvoicePreviewDialog } from "@/apps/admin/commerce/components/invoice-preview-dialog";
import { ensureDemoOrders } from "@/apps/admin/commerce/lib/order-utils";
import { runBrowserPrint } from "@/features/commerce/lib/print-invoice";
import {
  defaultInvoiceListFilters,
  EMPTY_INVOICE_OVERVIEW,
  exportInvoicesToCsv,
  filterInvoiceOrders,
  getInvoiceOverview,
  type InvoiceListFilters,
} from "@/apps/admin/commerce/lib/invoice-utils";
import {
  INVOICE_SETTINGS_UPDATED_EVENT,
  loadInvoiceSettings,
} from "@/features/commerce/lib/invoice-settings-repository";
import { defaultInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { getOrders, type PlacedOrder } from "@/features/orders/lib/orders";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import type { InvoiceSettings } from "@/types/invoice";

const PAGE_SIZE = 10;

type InvoiceTab = "invoices" | "design";

export function InvoicesAdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<InvoiceTab>("invoices");
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [filters, setFilters] = useState<InvoiceListFilters>(defaultInvoiceListFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printOrder, setPrintOrder] = useState<PlacedOrder | null>(null);
  const [previewOrder, setPreviewOrder] = useState<PlacedOrder | null>(null);
  const [invoiceSettings, setInvoiceSettings] =
    useState<InvoiceSettings>(defaultInvoiceSettings);
  const [commerceLabels, setCommerceLabels] = useState({
    taxLabel: defaultCommerceSettings.taxLabel,
    platformChargeLabel: defaultCommerceSettings.platformChargeLabel,
    giftWrapLabel: defaultCommerceSettings.giftWrapLabel,
  });

  useEffect(() => {
    function refreshOrders() {
      ensureDemoOrders();
      setOrders(getOrders());
    }
    function refreshSettings() {
      setInvoiceSettings(loadInvoiceSettings());
      const commerce = getCommerceSettings();
      setCommerceLabels({
        taxLabel: commerce.taxLabel,
        platformChargeLabel: commerce.platformChargeLabel,
        giftWrapLabel: commerce.giftWrapLabel,
      });
    }

    refreshOrders();
    refreshSettings();
    setMounted(true);

    window.addEventListener("bakery-orders-updated", refreshOrders);
    window.addEventListener(INVOICE_SETTINGS_UPDATED_EVENT, refreshSettings);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshSettings);
    return () => {
      window.removeEventListener("bakery-orders-updated", refreshOrders);
      window.removeEventListener(INVOICE_SETTINGS_UPDATED_EVENT, refreshSettings);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshSettings);
    };
  }, []);

  useEffect(() => {
    if (!printOrder) return;
    return runBrowserPrint(() => setPrintOrder(null));
  }, [printOrder]);

  const filtered = useMemo(() => filterInvoiceOrders(orders, filters), [orders, filters]);
  const overview = useMemo(
    () => (mounted ? getInvoiceOverview(orders) : EMPTY_INVOICE_OVERVIEW),
    [orders, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageIds = paginated.map((order) => order.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function updateFilters(patch: Partial<InvoiceListFilters>) {
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

  function handleExport() {
    const target =
      selectedIds.length > 0
        ? orders.filter((order) => selectedIds.includes(order.id))
        : filtered;
    if (target.length === 0) {
      toast.error("No invoices to export");
      return;
    }
    exportInvoicesToCsv(target);
    toast.success(`Exported ${target.length} invoice${target.length === 1 ? "" : "s"}`);
  }

  function handlePrint(order: PlacedOrder) {
    setPrintOrder(order);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <div className="print:hidden space-y-4 sm:space-y-5">
        <AdminPageHeader
          title="Invoices"
          description="Manage order invoices and print design"
          className="gap-3"
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {tab === "invoices" ? (
                <Button variant="bakery" className="w-full sm:w-auto" onClick={handleExport}>
                  <Download className="size-4" />
                  <span className="sm:hidden">Export</span>
                  <span className="hidden sm:inline">Export CSV</span>
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "invoices" as const, label: "Invoices", icon: Receipt },
              { id: "design" as const, label: "Design", icon: FileText },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "invoices" ? (
        <div className="print:hidden space-y-4 sm:space-y-5">
          <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => updateFilters({ payment: "paid" })}
            >
              <DashboardStatCard
                title="Paid"
                value={overview.paid}
                change="Prepaid orders"
                changeTone="positive"
                icon={IndianRupee}
                tone="bakery"
              />
            </button>
            <button
              type="button"
              className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => updateFilters({ payment: "cod" })}
            >
              <DashboardStatCard
                title="COD"
                value={overview.cod}
                change="Pay on delivery"
                changeTone="neutral"
                icon={Wallet}
                tone="gold"
              />
            </button>
          </section>

          <FilterPanel>
            <div className="space-y-3">
              <FilterPanelSearch
                value={filters.search}
                onChange={(value) => updateFilters({ search: value })}
                placeholder="Search invoice, customer, reference…"
              />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <AdminSelect
                  value={filters.status}
                  onChange={(event) =>
                    updateFilters({
                      status: event.target.value as InvoiceListFilters["status"],
                    })
                  }
                  aria-label="Order status"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </AdminSelect>
                <AdminSelect
                  value={filters.payment}
                  onChange={(event) =>
                    updateFilters({
                      payment: event.target.value as InvoiceListFilters["payment"],
                    })
                  }
                  aria-label="Payment status"
                >
                  <option value="all">All payments</option>
                  <option value="paid">Paid</option>
                  <option value="cod">COD</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </AdminSelect>
                <AdminSelect
                  className="col-span-2 md:col-span-1"
                  value={filters.dateRange}
                  onChange={(event) =>
                    updateFilters({
                      dateRange: event.target.value as InvoiceListFilters["dateRange"],
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
                icon={Receipt}
                title="No invoices found"
                description="Place a checkout order, or clear filters to see all invoices."
                className="py-14"
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">
                          <Checkbox
                            checked={allPageSelected}
                            onCheckedChange={toggleSelectPage}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Invoice</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Placed</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-border/70 transition-colors hover:bg-muted"
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedIds.includes(order.id)}
                              onCheckedChange={() => toggleSelect(order.id)}
                              aria-label={`Select ${order.orderNumber}`}
                            />
                          </td>
                          <td
                            className="cursor-pointer px-4 py-3 font-medium text-foreground"
                            onClick={() =>
                              router.push(routes.admin.orders.detail(order.id))
                            }
                          >
                            {order.orderNumber}
                          </td>
                          <td
                            className="max-w-[180px] cursor-pointer px-4 py-3"
                            onClick={() =>
                              router.push(routes.admin.orders.detail(order.id))
                            }
                          >
                            <p className="truncate">{order.address.fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {order.address.email}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <AdminOrderStatusBadge status={order.status} />
                          </td>
                          <td className="px-4 py-3">
                            <AdminPaymentStatusBadge status={order.paymentStatus} />
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(order.totals.total)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {formatRelativeTime(order.placedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewOrder(order)}
                              >
                                <Eye className="size-3.5" />
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrint(order)}
                              >
                                <Printer className="size-3.5" />
                                Print
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  router.push(routes.admin.orders.detail(order.id))
                                }
                              >
                                Open
                              </Button>
                            </div>
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
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() =>
                              router.push(routes.admin.orders.detail(order.id))
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {order.orderNumber}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {order.address.fullName} ·{" "}
                                  {formatRelativeTime(order.placedAt)}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold">
                                {formatCurrency(order.totals.total)}
                              </p>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <AdminOrderStatusBadge status={order.status} />
                              <AdminPaymentStatusBadge status={order.paymentStatus} />
                            </div>
                          </button>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => setPreviewOrder(order)}
                            >
                              <Eye className="size-3.5" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handlePrint(order)}
                            >
                              <Printer className="size-3.5" />
                              Print
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full"
                              onClick={() =>
                                router.push(routes.admin.orders.detail(order.id))
                              }
                            >
                              Open
                            </Button>
                          </div>
                        </div>
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
        </div>
      ) : (
        <div className="print:contents">
          <InvoiceDesignPanel />
        </div>
      )}

      {printOrder ? (
        <div className="hidden print:block">
          <InvoiceDocument
            order={printOrder}
            settings={invoiceSettings}
            taxLabel={commerceLabels.taxLabel}
            platformChargeLabel={commerceLabels.platformChargeLabel}
            giftWrapLabel={commerceLabels.giftWrapLabel}
            variant="print"
          />
        </div>
      ) : null}

      <InvoicePreviewDialog
        open={previewOrder !== null}
        order={previewOrder}
        settings={invoiceSettings}
        taxLabel={commerceLabels.taxLabel}
        platformChargeLabel={commerceLabels.platformChargeLabel}
        giftWrapLabel={commerceLabels.giftWrapLabel}
        onOpenChange={(open) => {
          if (!open) setPreviewOrder(null);
        }}
        onPrint={handlePrint}
      />
    </AdminPage>
  );
}

/** @deprecated Use InvoicesAdminPage */
export const InvoiceDesignerAdminPage = InvoicesAdminPage;
