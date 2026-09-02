import { downloadCsv, toCsv } from "@/utils/csv";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { settledRefundAmount, type RefundListFilters } from "@/features/orders/lib/order-overviews";
import type { RefundReasonCode, RefundStatus } from "@/types/refund";

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

export function countActiveRefundFilters(filters: RefundListFilters): number {
  let count = 0;
  if (filters.caseType !== "all") count += 1;
  if (filters.reason !== "all") count += 1;
  if (filters.dateRange !== "all") count += 1;
  return count;
}

export function exportRefundsToCsv(orders: PlacedOrder[]): void {
  if (typeof window === "undefined" || orders.length === 0) return;

  // "Amount" alone was the ORDER total, on an export whose every other column
  // describes a refund — so the file an operator hands their accountant listed
  // the sale value beside the refund's status and reference, and the refunded
  // figure appeared in no column at all.
  const headers = [
    "Order Number",
    "Customer",
    "Email",
    "Order Total",
    "Refunded Amount",
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
    String(settledRefundAmount(order)),
    order.status,
    order.refundRecord ? formatRefundStatus(order.refundRecord.status) : "—",
    order.refundRecord ? formatRefundReason(order.refundRecord.reason) : order.cancellationReason ?? "—",
    order.refundReference ?? order.refundRecord?.reference ?? "—",
    order.refundRecord?.requestedAt ?? "—",
    order.refundRecord?.completedAt ?? "—",
  ]);

  const csv = toCsv([headers, ...rows]);

  downloadCsv(`refunds-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

// Filters + counters live in the domain layer so the SERVER can run them over
// every order — the browser cache only holds the most recent slice, so a list
// or a total built from it is quietly short. Re-exported so admin imports keep
// resolving.
export {
  defaultRefundFilters,
  filterRefundCases,
  getRefundCaseStatus,
  getRefundOverview,
  isRefundCase,
  EMPTY_REFUND_OVERVIEW,
  type RefundCaseType,
  type RefundListFilters,
  type RefundOverview,
} from "@/features/orders/lib/order-overviews";
