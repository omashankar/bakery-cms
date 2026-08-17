"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
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
import {
  defaultRefundFilters,
  EMPTY_REFUND_OVERVIEW,
  exportRefundsToCsv,
  formatRefundReason,
  getRefundCaseStatus,
  REFUND_REASON_OPTIONS,
  type RefundListFilters,
  type RefundOverview,
} from "@/apps/admin/commerce/lib/refund-utils";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { type FiguresState } from "@/components/shared/panel-loading";
import {
  refundOrder,
  type PlacedOrder,
  type RefundOrderInput,
} from "@/features/orders/lib/orders";
import { fetchRefundCasesPage } from "@/features/orders/lib/orders-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";
import { reportedAsSignedOut } from "@/apps/admin/lib/report-write";

const PAGE_SIZE = 8;
/** Matches the server's max page size — one request, no client-side paging loop. */
const EXPORT_LIMIT = 500;

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
                {/*
                  "Refunded" is what has actually been PAID OUT.

                  This printed `refundRecord.amount` — the total asked for across
                  every attempt — under the word "refunded". A gateway refund
                  starts `pending` and settles at the bank's pace, so the moment
                  an operator issued one this screen said the money was back with
                  the customer. It is the screen they open to answer exactly that
                  question, and it answered it wrong for as long as the payout
                  took.
                */}
                <p className="font-semibold text-foreground">
                  {settledRefundAmount(order) > 0
                    ? `${formatCurrency(settledRefundAmount(order))} refunded`
                    : `${formatCurrency(order.refundRecord.amount)} sent to the gateway`}
                </p>
                <Badge variant={order.refundRecord.amount < order.totals.total ? "outline" : "accent"}>
                  {order.refundRecord.amount < order.totals.total ? "Partial" : "Full"}
                </Badge>
              </div>
              {settledRefundAmount(order) < order.refundRecord.amount ? (
                <p className="mt-0.5 text-xs text-warning">
                  {formatCurrency(order.refundRecord.amount - settledRefundAmount(order))} is still
                  with the gateway — it has not reached the customer yet.
                </p>
              ) : null}
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
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [filters, setFilters] = useState<RefundListFilters>(defaultRefundFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<PlacedOrder | null>(null);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<RefundOverview>(EMPTY_REFUND_OVERVIEW);
  const [reloadKey, setReloadKey] = useState(0);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  // The rows AND the counters come from one server snapshot over every order.
  // Filtering the browser cache here meant paging through only the most recent
  // slice, and a card could report a total the list below could not reach.
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
      const result = await fetchRefundCasesPage({ ...request.filters, page: request.page, limit: PAGE_SIZE });
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
  }, [requestKey, reloadKey]);

  // Chase refunds the gateway never reported settling, once per visit.
  //
  // A refund is created `pending` and the `refund.processed` webhook promotes
  // it — but a webhook is a delivery someone else makes, and when it does not
  // arrive the record sits at `processing` for good while the money has gone.
  // The operator opening this screen is exactly the person who wants that
  // resolved, so opening it asks. Reloads the list only when something changed.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (reconciledRef.current) return;
    reconciledRef.current = true;

    void fetch("/api/orders/refunds/reconcile", { method: "POST" })
      .then((res) => (noteAuthStatus(res.status) ? null : res.ok ? res.json() : null))
      .then((result: { settled?: number } | null) => {
        if (result?.settled) setReloadKey((key) => key + 1);
      })
      .catch(() => undefined);
  }, []);

  const paginated = orders;
  const selected = orders.find((order) => order.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !orders.some((order) => order.id === selectedId)) {
      setSelectedId(null);
    }
  }, [orders, selectedId]);

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

  async function handleRefundConfirm(input: RefundOrderInput) {
    if (!refundTarget) return;
    const {
      order: updated,
      persisted,
      error: refundError,
    } = await refundOrder(refundTarget.id, input);
    if (!updated) {
      // The order was not cached and the server read failed too. The dialog has
      // already closed itself, so without this the click produces nothing at all.
      setRefundTarget(null);
      if (!reportedAsSignedOut()) toast.error("Could not load that order", {
        description: "The server did not answer — reload and try again.",
      });
      return;
    }
    setRefundTarget(null);
    // Re-read only now that the refund has actually reached the server; the
    // local write announces itself before the request resolves.
    setReloadKey((key) => key + 1);
    setSelectedId(updated.id);

    if (!persisted) {
      // The server's own words, and ONLY those.
      //
      // This appended "No money has moved. Nothing was recorded." to every
      // refusal. It is not true of all of them: a gateway that accepts a payout
      // and returns no id has almost certainly moved the money, and a refund
      // already in flight may have too — and those are exactly the two the
      // screen was most confident about. Whether the money moved is something
      // only the refund path knows, so it says so in the message itself.
      // A 401 is not the gateway declining a refund — it is this browser not
      // being recognised. The two send an operator to completely different
      // places, and money is involved.
      if (!reportedAsSignedOut())
        toast.error(refundError ?? "The refund was not accepted.");
      return;
    }

    toast.success("Refund sent to the gateway", {
      description:
        "It usually settles in a few days. This screen updates when the gateway confirms.",
    });
  }

  async function handleExport() {
    // `total` is 0 after a FAILED load too, and telling the admin the shop has
    // no refund cases is a different claim from admitting the list never arrived.
    // orders-list and invoices already make this distinction.
    if (failed) {
      if (!reportedAsSignedOut()) toast.error("Could not load the refund cases to export", {
        description: "The server did not answer — reload and try again.",
      });
      return;
    }
    if (total === 0) {
      toast.error("No refund cases to export");
      return;
    }

    // The page holds PAGE_SIZE rows, so exporting the whole filtered set means
    // asking the server for it rather than writing out what happens to be visible.
    const result = await fetchRefundCasesPage({
      ...filters,
      page: 1,
      limit: Math.min(total, EXPORT_LIMIT),
    });
    if (!result || result.items.length === 0) {
      toast.error("Could not load refund cases to export");
      return;
    }

    exportRefundsToCsv(result.items);

    if (total > EXPORT_LIMIT) {
      toast.warning(`Exported the newest ${EXPORT_LIMIT} of ${total} refund cases`, {
        description: "Narrow the filters to export the rest.",
      });
      return;
    }

    toast.success(`Exported ${result.items.length} refund case${result.items.length === 1 ? "" : "s"}`);
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
            figures={statFigures}
          />
        </button>
        <DashboardStatCard
          title="Pending amount"
          value={formatCurrency(overview.pendingAmount)}
          change={openCases > 0 ? "Needs action" : "All clear"}
          changeTone={openCases > 0 ? "warning" : "positive"}
          icon={Clock3}
          tone="gold"
          figures={statFigures}
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
            figures={statFigures}
          />
        </button>
        <DashboardStatCard
          title="Refunded amount"
          value={formatCurrency(overview.refundedAmount)}
          change="Completed payouts"
          changeTone="neutral"
          icon={Banknote}
          tone="gold"
          figures={statFigures}
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
            {paginated.length === 0 && loading ? (
              // Asserting there are none before the server has answered is a
              // guess, and a wrong one on every cold load in a shop that has them.
              <div className="flex min-h-48 items-center justify-center py-14">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="sr-only">Loading refund cases</span>
              </div>
            ) : paginated.length === 0 ? (
              <EmptyState
                icon={RotateCcw}
                title={failed ? "Could not load refund cases" : "No refund cases"}
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

            {total > PAGE_SIZE ? (
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
