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

/**
 * Money that has actually gone back to the customer for this order.
 *
 * Only refunds the gateway confirmed count. A `pending` gateway refund has been
 * accepted but not paid out, a `failed` one moved nothing at all, and a
 * `requested` record is an intention with no payment behind it — `requestRefund`
 * writes one with the full order total and performs no payment check whatsoever,
 * so a cancelled COD order that never collected a rupee used to contribute its
 * whole value to the refunded figure.
 */
export function settledRefundAmount(order: PlacedOrder): number {
  const record = order.refundRecord;
  if (!record) return 0;

  const gatewayRefunds = record.gatewayRefunds;
  if (Array.isArray(gatewayRefunds) && gatewayRefunds.length > 0) {
    return gatewayRefunds
      .filter((refund) => refund.status === "processed")
      .reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
  }

  // No gateway list: either cash handed back, or a record written before gateway
  // refunds existed. Both are only money if the record says it completed.
  return record.status === "completed" ? Number(record.amount) || 0 : 0;
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

  // What was REFUNDED, not what the order was worth.
  //
  // This summed `totals.total`, so a ₹200 partial refund on a ₹5,000 order added
  // ₹5,000 to a card labelled "Completed payouts" — while the detail row two
  // inches below it, on the same screen, printed ₹200 from `refundRecord.amount`.
  // The Payments page used the right field, so the two admin screens reported
  // different totals for the same refunds.
  //
  // Counted over every case with a refund record rather than only orders whose
  // status is `refunded`, because a partial refund deliberately leaves the order
  // in its fulfilment status — the money still went out.
  const refundedAmount = cases.reduce((sum, order) => sum + settledRefundAmount(order), 0);
  // What is still OWED, not what the order was worth.
  //
  // This summed `totals.total`, so an order with a ₹200 partial refund still
  // settling contributed ₹5,000 to a card labelled as money waiting to go out —
  // and a case that was already half refunded counted its refunded half again.
  //
  // Each order is taken once (a cancelled order that has since had a refund
  // requested appeared in two buckets and was counted twice), and only the part
  // that has not yet been paid out.
  const pendingCases = new Map<string, PlacedOrder>();
  for (const order of [...cancelled, ...requested, ...processing]) {
    pendingCases.set(order.id, order);
  }

  // Money can only be owed back if it was taken.
  //
  // Every cancelled order counted, including a COD order cancelled before
  // delivery — where the customer handed over nothing. A shop that cancels a few
  // COD orders a day read a "Pending amount" of thousands it does not owe anyone
  // and cannot pay out, on a card that reads as a liability.
  //
  // `paid` covers a captured online payment and a COD order marked paid at the
  // door; `refunded` is one that was paid and has since been sent back, and its
  // unsettled remainder is still owed.
  const collected = (order: PlacedOrder) =>
    order.paymentStatus === "paid" || order.paymentStatus === "refunded";

  const pendingAmount = [...pendingCases.values()]
    .filter(collected)
    .reduce(
      (sum, order) => sum + Math.max(0, order.totals.total - settledRefundAmount(order)),
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
