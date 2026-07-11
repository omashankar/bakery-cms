import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import type { RefundReasonCode, RefundStatus } from "@/types/refund";

export type RefundCaseType = "all" | "cancelled" | "refunded" | "requested" | "processing";

export interface RefundListFilters {
  search: string;
  caseType: RefundCaseType;
  reason: RefundReasonCode | "all";
  dateRange: "all" | "7d" | "30d" | "90d";
}

export const defaultRefundFilters: RefundListFilters = {
  search: "",
  caseType: "all",
  reason: "all",
  dateRange: "all",
};

export const REFUND_REASON_OPTIONS: Array<{ value: RefundReasonCode; label: string }> = [
  { value: "customer_request", label: "Customer request" },
  { value: "duplicate_order", label: "Duplicate order" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "delivery_failed", label: "Delivery failed" },
  { value: "payment_error", label: "Payment error" },
  { value: "order_cancelled", label: "Order cancelled" },
  { value: "other", label: "Other" },
];

export function formatRefundReason(code: RefundReasonCode): string {
  return REFUND_REASON_OPTIONS.find((option) => option.value === code)?.label ?? code;
}

export function formatRefundStatus(status: RefundStatus): string {
  const labels: Record<RefundStatus, string> = {
    requested: "Requested",
    processing: "Processing",
    completed: "Completed",
    rejected: "Rejected",
  };
  return labels[status];
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

function matchesDateRange(timestamp: string | undefined, range: RefundListFilters["dateRange"]): boolean {
  if (range === "all" || !timestamp) return true;
  const placed = new Date(timestamp).getTime();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return placed >= cutoff;
}

export function filterRefundCases(
  orders: PlacedOrder[],
  filters: RefundListFilters
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
    if (!matchesDateRange(activityAt, filters.dateRange)) return false;

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

export function getRefundOverview(orders: PlacedOrder[]) {
  const cases = orders.filter(isRefundCase);
  const refunded = cases.filter((order) => order.status === "refunded");
  const cancelled = cases.filter((order) => order.status === "cancelled");
  const requested = cases.filter((order) => getRefundCaseStatus(order) === "requested");
  const processing = cases.filter((order) => getRefundCaseStatus(order) === "processing");

  const refundedAmount = refunded.reduce((sum, order) => sum + order.totals.total, 0);
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

export function countActiveRefundFilters(filters: RefundListFilters): number {
  let count = 0;
  if (filters.caseType !== "all") count += 1;
  if (filters.reason !== "all") count += 1;
  if (filters.dateRange !== "all") count += 1;
  return count;
}

export function exportRefundsToCsv(orders: PlacedOrder[]): void {
  if (typeof window === "undefined" || orders.length === 0) return;

  const headers = [
    "Order Number",
    "Customer",
    "Email",
    "Amount",
    "Order Status",
    "Refund Status",
    "Reason",
    "Reference",
    "Requested At",
    "Completed At",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.address.fullName,
    order.address.email,
    String(order.totals.total),
    order.status,
    order.refundRecord ? formatRefundStatus(order.refundRecord.status) : "—",
    order.refundRecord ? formatRefundReason(order.refundRecord.reason) : order.cancellationReason ?? "—",
    order.refundReference ?? order.refundRecord?.reference ?? "—",
    order.refundRecord?.requestedAt ?? "—",
    order.refundRecord?.completedAt ?? "—",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-refunds-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
