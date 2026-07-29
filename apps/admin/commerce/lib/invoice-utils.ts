import type { PlacedOrder } from "@/features/orders/lib/orders";

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

// Filters + counters live in the domain layer so the SERVER can run them over
// every order — the browser cache only holds the most recent slice, so a list
// or a total built from it is quietly short. Re-exported so admin imports keep
// resolving.
export {
  defaultInvoiceListFilters,
  filterInvoiceOrders,
  getInvoiceOverview,
  EMPTY_INVOICE_OVERVIEW,
  type InvoiceDateRange,
  type InvoiceListFilters,
  type InvoiceOverview,
} from "@/features/orders/lib/order-overviews";
