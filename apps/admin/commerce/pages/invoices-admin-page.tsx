"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Download,
  Loader2,
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
import { runBrowserPrint } from "@/features/commerce/lib/print-invoice";
import {
  defaultInvoiceListFilters,
  EMPTY_INVOICE_OVERVIEW,
  exportInvoicesToCsv,
  type InvoiceListFilters,
  type InvoiceOverview,
} from "@/apps/admin/commerce/lib/invoice-utils";
import {
  INVOICE_SETTINGS_UPDATED_EVENT,
  loadInvoiceSettings,
} from "@/features/commerce/lib/invoice-settings-repository";
import { ensureInvoiceSettingsHydrated } from "@/features/commerce/lib/use-invoice-settings-server-sync";
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
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { fetchInvoicesPage } from "@/features/orders/lib/orders-api";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { InvoiceSettings } from "@/types/invoice";

const PAGE_SIZE = 10;
/** Matches the server's max page size — one request, no client-side paging loop. */
const EXPORT_LIMIT = 500;

type InvoiceTab = "invoices" | "design";

export function InvoicesAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<InvoiceTab>("invoices");
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [overview, setOverview] = useState<InvoiceOverview>(EMPTY_INVOICE_OVERVIEW);
  const [filters, setFilters] = useState<InvoiceListFilters>(defaultInvoiceListFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printOrder, setPrintOrder] = useState<PlacedOrder | null>(null);
  const [previewOrder, setPreviewOrder] = useState<PlacedOrder | null>(null);
  const [invoiceSettings, setInvoiceSettings] =
    useState<InvoiceSettings>(defaultInvoiceSettings);
  const [commerceLabels, setCommerceLabels] = useState({
    taxLabel: defaultCommerceSettings.taxLabel,
    taxRate: defaultCommerceSettings.taxRate,
    platformChargeLabel: defaultCommerceSettings.platformChargeLabel,
    giftWrapLabel: defaultCommerceSettings.giftWrapLabel,
  });

  useEffect(() => {
    let cancelled = false;

    function refreshSettings() {
      setInvoiceSettings(loadInvoiceSettings());
      const commerce = getCommerceSettings();
      setCommerceLabels({
        taxLabel: commerce.taxLabel,
        taxRate: commerce.taxRate,
        platformChargeLabel: commerce.platformChargeLabel,
        giftWrapLabel: commerce.giftWrapLabel,
      });
    }

    refreshSettings();

    // Ask for the server's copy rather than waiting on the admin layout to.
    //
    // `loadInvoiceSettings()` SEEDS demo constants when localStorage is empty,
    // and this page PRINTS invoices from what it returns. The customer's copy
    // is now resolved server-side, so an admin printing before hydration landed
    // would hand out a document that disagrees with the customer's about who
    // issued it — the exact split this work set out to close, reopened from the
    // other side. The layout's sync runs from a `[]`-dep effect that never
    // re-runs after an in-app login, which is why waiting is not enough.
    void ensureInvoiceSettingsHydrated().then((settled) => {
      if (!cancelled && settled) refreshSettings();
    });

    window.addEventListener(INVOICE_SETTINGS_UPDATED_EVENT, refreshSettings);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshSettings);
    return () => {
      cancelled = true;
      window.removeEventListener(INVOICE_SETTINGS_UPDATED_EVENT, refreshSettings);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshSettings);
    };
  }, []);

  // Rows AND counters from one server snapshot over every order. Filtering the
  // browser cache meant paging through only the most recent slice, and a card
  // could report a total the list below could not reach.
  // One debounced key for filters AND page. The search box is undebounced
  // and each request filters the whole orders collection server-side, so
  // keying the fetch straight off the input turned a six-letter name into
  // six full-collection queries, five of them already stale on arrival.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // The request uses the CLAMPED page. Filters or a mutation can shrink the
  // result set under the page the admin is on; asking for the raw page then
  // returns nothing and hides the pager, stranding them with no way back.
  const liveKey = JSON.stringify({ filters, page: currentPage });
  const requestKey = useDebouncedValue(liveKey, 250);
  // `loading` is re-armed only when the DEBOUNCED key changes, so for the first
  // 250ms after a filter change the fetch has not started yet and the old,
  // already wrong result is still on screen — asserted as "No invoices found"
  // rather than shown as pending.
  const pending = loading || requestKey !== liveKey;
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
      const result = await fetchInvoicesPage({ ...request.filters, page: request.page, limit: PAGE_SIZE });
      if (cancelled) return;
      if (result) {
        setOrders(result.items);
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

  useEffect(() => {
    if (!printOrder) return;
    return runBrowserPrint(() => setPrintOrder(null));
  }, [printOrder]);

  const paginated = orders;
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

  /**
   * The exportable slice of the current filters, straight from the server — the
   * page in front of the admin holds only PAGE_SIZE rows. Asked for the full
   * EXPORT_LIMIT rather than `Math.min(total, …)`, because `total` is whatever
   * the last page load reported and the collection moves underneath it.
   */
  async function loadForExport() {
    setExporting(true);
    // The DEBOUNCED filters, matching the rows on screen and the count beside
    // them — not the live inputs, which may be a keystroke ahead of both.
    const result = await fetchInvoicesPage({ ...request.filters, page: 1, limit: EXPORT_LIMIT });
    setExporting(false);
    return result;
  }

  async function handleExport() {
    if (exporting) return;

    if (selectedIds.length > 0) {
      const onThisPage = orders.filter((order) => selectedIds.includes(order.id));

      // A selection SURVIVES paging — only a filter change or Clear resets it —
      // so it routinely covers rows the current page does not hold. Writing out
      // just the visible ones would drop the rest without saying so.
      if (onThisPage.length === selectedIds.length) {
        exportInvoicesToCsv(onThisPage);
        toast.success(`Exported ${onThisPage.length} invoice${onThisPage.length === 1 ? "" : "s"}`);
        return;
      }

      const wider = await loadForExport();
      // Merge rather than replace: the visible rows are already in hand, so a
      // failed or short widening should cost the admin the rows it could not
      // reach — not the ones on screen in front of them.
      const byId = new Map(onThisPage.map((order) => [order.id, order]));
      for (const order of wider?.items ?? []) {
        if (selectedIds.includes(order.id)) byId.set(order.id, order);
      }

      const target = [...byId.values()];
      if (target.length === 0) {
        toast.error("Could not load the selected invoices to export");
        return;
      }

      exportInvoicesToCsv(target);
      if (target.length < selectedIds.length) {
        // Distinguish "the request failed" from "the range does not reach them".
        // Advising an admin to narrow their filters when the fetch simply 500'd
        // sends them off to solve the wrong problem.
        toast.warning(`Exported ${target.length} of ${selectedIds.length} selected invoices`, {
          description: wider
            ? "The rest fall outside the exportable range — narrow the filters."
            : "The rest could not be loaded. Check your connection and try again.",
        });
        return;
      }
      toast.success(`Exported ${target.length} invoice${target.length === 1 ? "" : "s"}`);
      return;
    }

    // `total` is 0 both when there are genuinely no invoices and when the page
    // load failed before it ever learned the count. Only the first is a reason to
    // refuse; the second gets the export fetch, which may well work.
    if (total === 0 && !failed) {
      toast.error("No invoices to export");
      return;
    }

    const result = await loadForExport();
    if (!result || result.items.length === 0) {
      toast.error("Could not load invoices to export");
      return;
    }

    exportInvoicesToCsv(result.items);

    // The server's own count, not the card's — `total` is from the last page
    // this screen loaded, and invoices raised since then would be silently
    // omitted from both the export and the warning about the omission.
    if (result.total > result.items.length) {
      toast.warning(`Exported the newest ${result.items.length} of ${result.total} invoices`, {
        description: "Narrow the filters to export the rest.",
      });
      return;
    }

    toast.success(`Exported ${result.items.length} invoice${result.items.length === 1 ? "" : "s"}`);
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
          {/*
            These count EVERY order, not the filtered list below them — they are
            filter shortcuts, so a count that collapsed to the current filter
            would read zero the moment you used one. "all time" says so, because
            the number sitting above a filtered list otherwise reads as a count
            of what is on screen. The Transaction Center makes the same
            distinction explicitly; this one made it silently.
          */}
          <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => updateFilters({ payment: "paid" })}
            >
              <DashboardStatCard
                title="Paid"
                value={overview.paid}
                change="Prepaid orders · all time"
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
                change="Pay on delivery · all time"
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

            {paginated.length === 0 && pending ? (
              // Asserting there are none before the server has answered is a
              // guess, and a wrong one on every cold load in a shop that has them.
              <div className="flex min-h-48 items-center justify-center py-14">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="sr-only">Loading invoices</span>
              </div>
            ) : paginated.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={failed ? "Could not load invoices" : "No invoices found"}
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
            currentTaxRate={commerceLabels.taxRate}
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
        currentTaxRate={commerceLabels.taxRate}
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
