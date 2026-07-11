import type { OrderStatus, PaymentStatus, PlacedOrder } from "@/features/storefront/checkout/lib/orders";

export type InvoiceDateRange = "all" | "7d" | "30d" | "90d";

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

function matchesDateRange(placedAt: string, range: InvoiceDateRange): boolean {
  if (range === "all") return true;
  const placed = new Date(placedAt).getTime();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return placed >= cutoff;
}

export function filterInvoiceOrders(
  orders: PlacedOrder[],
  filters: InvoiceListFilters
): PlacedOrder[] {
  const search = filters.search.trim().toLowerCase();

  return orders.filter((order) => {
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (filters.payment !== "all" && order.paymentStatus !== filters.payment) return false;
    if (!matchesDateRange(order.placedAt, filters.dateRange)) return false;

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

export function getInvoiceOverview(orders: PlacedOrder[]): InvoiceOverview {
  return orders.reduce<InvoiceOverview>(
    (acc, order) => {
      acc.total += 1;
      if (order.paymentStatus === "paid") acc.paid += 1;
      if (order.paymentStatus === "cod") acc.cod += 1;
      if (order.paymentStatus === "refunded" || order.status === "refunded") {
        acc.refunded += 1;
      }
      if (order.status !== "cancelled") {
        acc.invoicedAmount += order.totals.total;
      }
      return acc;
    },
    { ...EMPTY_INVOICE_OVERVIEW }
  );
}

export function exportInvoicesToCsv(orders: PlacedOrder[]): void {
  const headers = [
    "Invoice",
    "Customer",
    "Email",
    "Phone",
    "Status",
    "Payment",
    "Reference",
    "Amount",
    "Placed",
  ];
  const rows = orders.map((order) => [
    order.orderNumber,
    order.address.fullName,
    order.address.email,
    order.address.phone,
    order.status,
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
  link.download = `bakery-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
