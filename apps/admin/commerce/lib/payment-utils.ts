import type {
  PaymentStatus,
  PlacedOrder,
} from "@/features/orders/lib/orders";
import type { PaymentMethod } from "@/features/orders/lib/checkout-draft";

export type PaymentStatusFilter = PaymentStatus | "all";
export type PaymentMethodFilter = PaymentMethod | "all";
export type PaymentDateRange = "all" | "7d" | "30d" | "90d";

export interface PaymentListFilters {
  search: string;
  status: PaymentStatusFilter;
  method: PaymentMethodFilter;
  dateRange: PaymentDateRange;
}

export const defaultPaymentFilters: PaymentListFilters = {
  search: "",
  status: "all",
  method: "all",
  dateRange: "all",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Card",
  razorpay: "Online (Razorpay)",
};

function matchesDateRange(placedAt: string, range: PaymentDateRange): boolean {
  if (range === "all") return true;
  const placed = new Date(placedAt).getTime();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return placed >= cutoff;
}

export function filterPaymentOrders(
  orders: PlacedOrder[],
  filters: PaymentListFilters
): PlacedOrder[] {
  const search = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (filters.status !== "all" && order.paymentStatus !== filters.status) return false;
    if (filters.method !== "all" && order.paymentMethod !== filters.method) return false;
    if (!matchesDateRange(order.placedAt, filters.dateRange)) return false;

    if (!search) return true;

    const haystack = [
      order.orderNumber,
      order.address.fullName,
      order.address.email,
      order.address.phone,
      order.paymentMethod,
      order.paymentStatus,
      order.paymentReference ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function exportPaymentsToCsv(orders: PlacedOrder[]): void {
  const headers = [
    "Order",
    "Customer",
    "Email",
    "Phone",
    "Method",
    "Status",
    "Reference",
    "Amount",
    "Placed",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.address.fullName,
    order.address.email,
    order.address.phone,
    order.paymentMethod,
    order.paymentStatus,
    order.paymentReference ?? "",
    String(order.totals.total),
    order.placedAt,
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
