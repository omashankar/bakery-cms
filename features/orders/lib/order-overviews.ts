/**
 * Overview counters for the refund, invoice and payment admin screens.
 *
 * These live in the domain layer so the SERVER can compute them across every
 * order. They used to run in the browser over the cached slice of recent
 * orders, which meant each card understated itself — and a total that is merely
 * too small still looks like a total.
 *
 * Note these deliberately do NOT share one definition of revenue: the reports
 * revenue excludes cancelled and refunded orders, `invoicedAmount` below
 * excludes only cancelled, and refunds count their own amounts. They answer
 * different questions and are consumed by different cards.
 */
import type { OrderStatus, PaymentStatus, PlacedOrder } from "@/features/orders/lib/orders";
import type { RefundReasonCode, RefundStatus } from "@/types/refund";

export type CommerceDateRange = "all" | "7d" | "30d" | "90d";

/**
 * `timestamp` is optional because the refund list dates off a refund's own
 * activity, which a cancelled-but-never-refunded order does not have.
 */
function matchesDateRange(
  timestamp: string | undefined,
  range: CommerceDateRange,
  nowMs = Date.now()
): boolean {
  if (range === "all" || !timestamp) return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(timestamp).getTime() >= nowMs - days * 86_400_000;
}

export function getRefundCaseStatus(order: PlacedOrder): RefundStatus | "cancelled" | "none" {
  if (order.status === "refunded") {
    return order.refundRecord?.status ?? "completed";
  }
  if (order.refundRecord?.status) {
    return order.refundRecord.status;
  }
  if (order.status === "cancelled") return "cancelled";
  return "none";
}

export function isRefundCase(order: PlacedOrder): boolean {
  return (
    order.status === "cancelled" ||
    order.status === "refunded" ||
    Boolean(order.refundRecord)
  );
}

export interface RefundOverview {
  totalCases: number;
  refundedCount: number;
  cancelledCount: number;
  requestedCount: number;
  processingCount: number;
  refundedAmount: number;
  pendingAmount: number;
}

export const EMPTY_REFUND_OVERVIEW: RefundOverview = {
  totalCases: 0,
  refundedCount: 0,
  cancelledCount: 0,
  requestedCount: 0,
  processingCount: 0,
  refundedAmount: 0,
  pendingAmount: 0,
};

export function getRefundOverview(orders: PlacedOrder[]): RefundOverview {
  const cases = orders.filter(isRefundCase);
  const refunded = cases.filter((order) => order.status === "refunded");
  const cancelled = cases.filter((order) => order.status === "cancelled");
  const requested = cases.filter((order) => getRefundCaseStatus(order) === "requested");
  const processing = cases.filter((order) => getRefundCaseStatus(order) === "processing");

  const refundedAmount = refunded.reduce((sum, order) => sum + order.totals.total, 0);
  // A cancelled order that has since had a refund requested is in BOTH the
  // cancelled and the requested bucket, so its total is counted twice here.
  // Preserved deliberately: this is the figure the Refund Center has always
  // shown, and quietly halving it would be its own surprise.
  const pendingAmount = [...cancelled, ...requested, ...processing].reduce(
    (sum, order) => sum + order.totals.total,
    0
  );

  return {
    totalCases: cases.length,
    refundedCount: refunded.length,
    cancelledCount: cancelled.length,
    requestedCount: requested.length,
    processingCount: processing.length,
    refundedAmount,
    pendingAmount,
  };
}

export interface InvoiceOverview {
  total: number;
  paid: number;
  cod: number;
  refunded: number;
  invoicedAmount: number;
}

export const EMPTY_INVOICE_OVERVIEW: InvoiceOverview = {
  total: 0,
  paid: 0,
  cod: 0,
  refunded: 0,
  invoicedAmount: 0,
};

export function getInvoiceOverview(orders: PlacedOrder[]): InvoiceOverview {
  return orders.reduce<InvoiceOverview>(
    (acc, order) => {
      acc.total += 1;
      if (order.paymentStatus === "paid") acc.paid += 1;
      if (order.paymentStatus === "cod") acc.cod += 1;
      if (order.paymentStatus === "refunded" || order.status === "refunded") {
        acc.refunded += 1;
      }
      // Invoiced means "billed", so a refunded order still counts — only a
      // cancelled one was never invoiced at all.
      if (order.status !== "cancelled") {
        acc.invoicedAmount += order.totals.total;
      }
      return acc;
    },
    { ...EMPTY_INVOICE_OVERVIEW }
  );
}

export type RefundCaseType = "all" | "cancelled" | "refunded" | "requested" | "processing";

export interface RefundListFilters {
  search: string;
  caseType: RefundCaseType;
  reason: RefundReasonCode | "all";
  dateRange: CommerceDateRange;
}

export const defaultRefundFilters: RefundListFilters = {
  search: "",
  caseType: "all",
  reason: "all",
  dateRange: "all",
};

/**
 * Refund cases matching the filters.
 *
 * Runs on the server over every order so the list and its counters come from
 * one snapshot. None of these predicates can be pushed into a Mongo query as-is:
 * the case status is derived from `status` and `refundRecord` together, the
 * reason falls back to a synthetic `order_cancelled`, and the date filter keys
 * off refund activity rather than `placedAt`.
 */
export function filterRefundCases(
  orders: PlacedOrder[],
  filters: RefundListFilters,
  nowMs = Date.now()
): PlacedOrder[] {
  const search = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (!isRefundCase(order)) return false;

    const caseStatus = getRefundCaseStatus(order);

    if (filters.caseType === "cancelled" && order.status !== "cancelled") return false;
    if (filters.caseType === "refunded" && order.status !== "refunded") return false;
    if (filters.caseType === "requested" && caseStatus !== "requested") return false;
    if (filters.caseType === "processing" && caseStatus !== "processing") return false;

    if (filters.reason !== "all") {
      const orderReason =
        order.refundRecord?.reason ??
        (order.status === "cancelled" ? "order_cancelled" : undefined);
      if (orderReason !== filters.reason) return false;
    }

    const activityAt =
      order.refundRecord?.completedAt ??
      order.refundRecord?.requestedAt ??
      order.placedAt;
    if (!matchesDateRange(activityAt, filters.dateRange, nowMs)) return false;

    if (!search) return true;

    const haystack = [
      order.orderNumber,
      order.address.fullName,
      order.address.email,
      order.refundReference,
      order.refundRecord?.reference,
      order.cancellationReason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export type InvoiceDateRange = CommerceDateRange;

export interface InvoiceListFilters {
  search: string;
  status: OrderStatus | "all";
  payment: PaymentStatus | "all";
  dateRange: InvoiceDateRange;
}

export const defaultInvoiceListFilters: InvoiceListFilters = {
  search: "",
  status: "all",
  payment: "all",
  dateRange: "all",
};

export function filterInvoiceOrders(
  orders: PlacedOrder[],
  filters: InvoiceListFilters,
  nowMs = Date.now()
): PlacedOrder[] {
  const search = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (filters.payment !== "all" && order.paymentStatus !== filters.payment) return false;
    if (!matchesDateRange(order.placedAt, filters.dateRange, nowMs)) return false;

    if (!search) return true;

    const haystack = [
      order.orderNumber,
      order.address.fullName,
      order.address.email,
      order.address.phone,
      order.paymentReference ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}
