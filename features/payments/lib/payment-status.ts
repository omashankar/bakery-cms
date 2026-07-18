import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * Rich 12-state transaction status — a DERIVED view over the order's existing
 * 5-state paymentStatus. The stored data / core `PaymentStatus` type are untouched
 * (non-breaking); this is only how the Transaction Center presents state.
 */
export type TransactionStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "captured"
  | "partially_paid"
  | "failed"
  | "cancelled"
  | "refund_initiated"
  | "refunded"
  | "expired"
  | "cod_pending"
  | "cod_paid";

export type StatusGroup = "success" | "pending" | "failed" | "refund" | "cod";

export const TRANSACTION_STATUS_META: Record<
  TransactionStatus,
  { label: string; className: string; group: StatusGroup }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800", group: "pending" },
  authorized: { label: "Authorized", className: "bg-blue-100 text-blue-800", group: "pending" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800", group: "success" },
  captured: { label: "Captured", className: "bg-green-100 text-green-800", group: "success" },
  partially_paid: { label: "Partially Paid", className: "bg-amber-100 text-amber-800", group: "pending" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700", group: "failed" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", group: "failed" },
  refund_initiated: { label: "Refund Initiated", className: "bg-blue-100 text-blue-800", group: "refund" },
  refunded: { label: "Refunded", className: "bg-blue-100 text-blue-800", group: "refund" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground", group: "failed" },
  cod_pending: { label: "COD Pending", className: "bg-cream-100 text-bakery-700", group: "cod" },
  cod_paid: { label: "COD Paid", className: "bg-green-100 text-green-800", group: "cod" },
};

export const TRANSACTION_STATUS_ORDER: TransactionStatus[] = [
  "captured",
  "paid",
  "authorized",
  "pending",
  "partially_paid",
  "cod_pending",
  "cod_paid",
  "failed",
  "cancelled",
  "expired",
  "refund_initiated",
  "refunded",
];

/** Maps an order's real state to a rich transaction status for display. */
export function deriveTransactionStatus(order: PlacedOrder): TransactionStatus {
  const refund = order.refundRecord;
  if (refund) {
    if (refund.status === "completed") return "refunded";
    if (refund.status === "requested" || refund.status === "processing") return "refund_initiated";
  }

  if (order.status === "cancelled") return "cancelled";

  if (order.paymentMethod === "cod") {
    return order.status === "delivered" ? "cod_paid" : "cod_pending";
  }

  switch (order.paymentStatus) {
    case "paid":
      return "captured";
    case "pending":
      return "pending";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "captured";
  }
}
