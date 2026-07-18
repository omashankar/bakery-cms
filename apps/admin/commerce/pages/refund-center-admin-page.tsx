"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { MobileDetailDrawer } from "@/components/shared/mobile-detail-drawer";
import { RefundOrderDialog } from "@/apps/admin/commerce/components/refund-order-dialog";
import { RefundStatusBadge } from "@/apps/admin/commerce/components/refund-status-badge";
import { RefundTimeline } from "@/apps/admin/commerce/components/refund-timeline";
import { ensureDemoRefundCases } from "@/apps/admin/commerce/lib/refund-demo";
import {
  defaultRefundFilters,
  exportRefundsToCsv,
  filterRefundCases,
  formatRefundReason,
  getRefundCaseStatus,
  getRefundOverview,
  REFUND_REASON_OPTIONS,
  type RefundListFilters,
} from "@/apps/admin/commerce/lib/refund-utils";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import {
  getOrders,
  refundOrder,
  type PlacedOrder,
  type RefundOrderInput,
} from "@/features/orders/lib/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 8;

const EMPTY_OVERVIEW = {
  totalCases: 0,
  refundedCount: 0,
  cancelledCount: 0,
  requestedCount: 0,
  processingCount: 0,
  refundedAmount: 0,
  pendingAmount: 0,
};

const caseTabs: Array<{
  value: RefundListFilters["caseType"];
  label: string;
  short: string;
}> = [
  { value: "all", label: "All", short: "All" },
  { value: "cancelled", label: "Cancelled", short: "Cancel" },
  { value: "requested", label: "Requested", short: "Request" },
  { value: "processing", label: "Processing", short: "Process" },
  { value: "refunded", label: "Refunded", short: "Done" },
];

function RefundCaseDetail({
  order,
  onIssueRefund,
}: {
  order: PlacedOrder;
  onIssueRefund: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{order.orderNumber}</CardTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {order.address.fullName} · {formatCurrency(order.totals.total)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            render={<Link href={routes.admin.orders.detail(order.id)} />}
          >
            View order
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Order status</p>
              <p className="mt-0.5 capitalize font-medium">
                {order.status.replace(/_/g, " ")}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Payment</p>
              <p className="mt-0.5 font-medium uppercase">{order.paymentStatus}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Placed</p>
              <p className="mt-0.5">{formatRelativeTime(order.placedAt)}</p>
            </div>
            {order.refundReference ? (
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Reference</p>
                <p className="mt-0.5 truncate font-medium">{order.refundReference}</p>
              </div>
            ) : null}
          </div>

          {order.refundRecord ? (
            <div className="rounded-lg border border-border bg-muted/80 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {formatCurrency(order.refundRecord.amount)} refunded
                </p>
                <Badge variant={order.refundRecord.amount < order.totals.total ? "outline" : "accent"}>
                  {order.refundRecord.amount < order.totals.total ? "Partial" : "Full"}
                </Badge>
              </div>
              {order.refundRecord.amount < order.totals.total ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Remaining {formatCurrency(order.totals.total - order.refundRecord.amount)} of{" "}
                  {formatCurrency(order.totals.total)}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-muted-foreground">Reason</p>
              <p className="mt-0.5 font-medium">
                {formatRefundReason(order.refundRecord.reason)}
              </p>
              {order.refundRecord.reasonDetail ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.refundRecord.reasonDetail}
                </p>
              ) : null}
              {order.refundRecord.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes: {order.refundRecord.notes}
                </p>
              ) : null}
            </div>
          ) : order.cancellationReason ? (
            <div className="rounded-lg border border-border bg-muted/80 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Cancellation reason</p>
              <p className="mt-0.5 text-sm">{order.cancellationReason}</p>
            </div>
          ) : null}

          {order.status !== "refunded" ? (
            <Button variant="bakery" className="w-full" onClick={onIssueRefund}>
              Issue refund
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <RefundTimeline events={order.refundRecord?.history ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

export function RefundCenterAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [filters, setFilters] = useState<RefundListFilters>(defaultRefundFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<PlacedOrder | null>(null);

  function refresh() {
    setOrders(getOrders());
    setMounted(true);
  }

  useEffect(() => {
    ensureDemoRefundCases();
    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, []);

  const filtered = useMemo(() => filterRefundCases(orders, filters), [orders, filters]);
  const overview = useMemo(
    () => (mounted ? getRefundOverview(orders) : EMPTY_OVERVIEW),
    [orders, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = filtered.find((order) => order.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !filtered.some((order) => order.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  function updateFilters(patch: Partial<RefundListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function countForTab(caseType: RefundListFilters["caseType"]) {
    if (caseType === "all") return overview.totalCases;
    if (caseType === "cancelled") return overview.cancelledCount;
    if (caseType === "refunded") return overview.refundedCount;
    if (caseType === "requested") return overview.requestedCount;
    return overview.processingCount;
  }

  function handleRefundConfirm(input: RefundOrderInput) {
    if (!refundTarget) return;
    const updated = refundOrder(refundTarget.id, input);
    if (!updated) return;
    setRefundTarget(null);
    refresh();
    setSelectedId(updated.id);
    toast.success("Refund recorded", { description: updated.refundReference });
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("No refund cases to export");
      return;
    }
    exportRefundsToCsv(filtered);
    toast.success(`Exported ${filtered.length} refund case${filtered.length === 1 ? "" : "s"}`);
  }

  const openCases =
    overview.cancelledCount + overview.requestedCount + overview.processingCount;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Refunds"
        description="Cancellations and refund cases."
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
          onClick={() => updateFilters({ caseType: "all", reason: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total cases"
            value={overview.totalCases}
            change="All refund cases"
            changeTone="neutral"
            icon={RotateCcw}
            tone="bakery"
          />
        </button>
        <DashboardStatCard
          title="Pending amount"
          value={formatCurrency(overview.pendingAmount)}
          change={openCases > 0 ? "Needs action" : "All clear"}
          changeTone={openCases > 0 ? "warning" : "positive"}
          icon={Clock3}
          tone="gold"
        />
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ caseType: "refunded" })}
        >
          <DashboardStatCard
            title="Refunded"
            value={overview.refundedCount}
            change="Completed cases"
            changeTone="positive"
            icon={CheckCircle2}
            tone="bakery"
          />
        </button>
        <DashboardStatCard
          title="Refunded amount"
          value={formatCurrency(overview.refundedAmount)}
          change="Completed payouts"
          changeTone="neutral"
          icon={Banknote}
          tone="gold"
        />
      </section>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1.5 pb-0.5">
          {caseTabs.map((tab) => {
            const active = filters.caseType === tab.value;
            return (
              <Button
                key={tab.value}
                size="sm"
                variant={active ? "bakery" : "outline"}
                onClick={() => updateFilters({ caseType: tab.value })}
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className={cn(
                    "h-5 min-w-5 justify-center px-1.5 text-[10px]",
                    active && "border-transparent bg-primary-foreground/20 text-primary-foreground"
                  )}
                >
                  {countForTab(tab.value)}
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
            placeholder="Search order, customer, reference…"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <AdminSelect
              className="w-full sm:w-44"
              value={filters.reason}
              onChange={(event) =>
                updateFilters({
                  reason: event.target.value as RefundListFilters["reason"],
                })
              }
              aria-label="Refund reason"
            >
              <option value="all">All reasons</option>
              {REFUND_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-36"
              value={filters.dateRange}
              onChange={(event) =>
                updateFilters({
                  dateRange: event.target.value as RefundListFilters["dateRange"],
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

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <Card className="shadow-sm xl:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {paginated.length === 0 ? (
              <EmptyState
                icon={RotateCcw}
                title="No refund cases"
                description="Cancelled or refunded orders will appear here."
              />
            ) : (
              paginated.map((order) => {
                const caseStatus = getRefundCaseStatus(order);
                const active = selected?.id === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-premium sm:px-4",
                      active
                        ? "border-primary/40 bg-muted"
                        : "border-border bg-card hover:border-border"
                    )}
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
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(order.totals.total)}
                        </p>
                        <div className="mt-1.5 flex justify-end">
                          <RefundStatusBadge
                            status={caseStatus === "none" ? "cancelled" : caseStatus}
                          />
                        </div>
                      </div>
                    </div>
                    {order.refundRecord ? (
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {formatRefundReason(order.refundRecord.reason)}
                        {order.refundReference ? ` · ${order.refundReference}` : ""}
                      </p>
                    ) : order.cancellationReason ? (
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        Cancelled: {order.cancellationReason}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}

            {filtered.length > PAGE_SIZE ? (
              <ListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                className="pt-1"
              />
            ) : null}
          </CardContent>
        </Card>

        <aside className="hidden min-w-0 space-y-4 xl:col-span-5 xl:block">
          {selected ? (
            <RefundCaseDetail
              order={selected}
              onIssueRefund={() => setRefundTarget(selected)}
            />
          ) : (
            <Card className="shadow-sm">
              <CardContent className="py-10">
                <EmptyState
                  icon={RotateCcw}
                  title="Select a case"
                  description="Choose a refund case to view details and timeline."
                />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <MobileDetailDrawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.orderNumber ?? "Case details"}
      >
        {selected ? (
          <div className="space-y-4 p-4">
            <RefundCaseDetail
              order={selected}
              onIssueRefund={() => setRefundTarget(selected)}
            />
          </div>
        ) : null}
      </MobileDetailDrawer>

      <RefundOrderDialog
        open={Boolean(refundTarget)}
        orderNumber={refundTarget?.orderNumber}
        totalLabel={refundTarget ? formatCurrency(refundTarget.totals.total) : undefined}
        orderTotal={refundTarget?.totals.total}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
        onConfirm={handleRefundConfirm}
      />
    </AdminPage>
  );
}
