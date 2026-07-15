import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import type { PaymentMethod } from "@/features/storefront/checkout/lib/checkout-draft";
import { getGatewayConfig } from "@/features/payments/registry/gateways";
import {
  deriveTransactionStatus,
  TRANSACTION_STATUS_META,
  type StatusGroup,
  type TransactionStatus,
} from "@/features/payments/lib/payment-status";

export interface TransactionView {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  gatewayId: string;
  gatewayName: string;
  method: PaymentMethod;
  amount: number;
  tax: number;
  discount: number;
  status: TransactionStatus;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

/** Which gateway processed each method (legacy upi/card ran through Razorpay). */
const METHOD_GATEWAY: Record<string, string> = {
  cod: "cod",
  razorpay: "razorpay",
  upi: "razorpay",
  card: "razorpay",
};

export function buildTransactions(orders: PlacedOrder[]): TransactionView[] {
  return orders.map((order) => {
    const gatewayId = METHOD_GATEWAY[order.paymentMethod] ?? "razorpay";
    const updatedAt =
      order.statusHistory?.[order.statusHistory.length - 1]?.at ?? order.placedAt;
    return {
      id: order.paymentReference || `TXN-${order.orderNumber}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.address?.fullName ?? "—",
      customerEmail: order.address?.email ?? "",
      gatewayId,
      gatewayName: getGatewayConfig(gatewayId)?.name ?? gatewayId,
      method: order.paymentMethod,
      amount: order.totals.total,
      tax: order.totals.tax ?? 0,
      discount: order.totals.discount ?? 0,
      status: deriveTransactionStatus(order),
      reference: order.paymentReference,
      createdAt: order.placedAt,
      updatedAt,
    };
  });
}

export interface TransactionFilters {
  search: string;
  gateway: string; // "all" | gatewayId
  method: string; // "all" | method
  statusGroup: "all" | StatusGroup;
  dateRange: "all" | "7d" | "30d" | "90d";
  minAmount: string;
  maxAmount: string;
}

export const defaultTransactionFilters: TransactionFilters = {
  search: "",
  gateway: "all",
  method: "all",
  statusGroup: "all",
  dateRange: "all",
  minAmount: "",
  maxAmount: "",
};

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function applyTransactionFilters(
  txns: TransactionView[],
  filters: TransactionFilters
): TransactionView[] {
  const q = filters.search.trim().toLowerCase();
  const min = filters.minAmount ? Number(filters.minAmount) : null;
  const max = filters.maxAmount ? Number(filters.maxAmount) : null;
  const days = RANGE_DAYS[filters.dateRange];
  const cutoff = days ? Date.now() - days * 86_400_000 : null;

  return txns.filter((t) => {
    if (
      q &&
      !`${t.orderNumber} ${t.customerName} ${t.customerEmail} ${t.id} ${t.reference ?? ""}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    if (filters.gateway !== "all" && t.gatewayId !== filters.gateway) return false;
    if (filters.method !== "all" && t.method !== filters.method) return false;
    if (
      filters.statusGroup !== "all" &&
      TRANSACTION_STATUS_META[t.status].group !== filters.statusGroup
    ) {
      return false;
    }
    if (min !== null && t.amount < min) return false;
    if (max !== null && t.amount > max) return false;
    if (cutoff && new Date(t.createdAt).getTime() < cutoff) return false;
    return true;
  });
}

export function exportTransactionsToCsv(txns: TransactionView[]) {
  const headers = [
    "Transaction ID",
    "Order",
    "Customer",
    "Email",
    "Gateway",
    "Method",
    "Amount",
    "Tax",
    "Discount",
    "Status",
    "Reference",
    "Created",
    "Updated",
  ];
  const rows = txns.map((t) => [
    t.id,
    t.orderNumber,
    t.customerName,
    t.customerEmail,
    t.gatewayName,
    t.method,
    t.amount,
    t.tax,
    t.discount,
    TRANSACTION_STATUS_META[t.status].label,
    t.reference ?? "",
    t.createdAt,
    t.updatedAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
