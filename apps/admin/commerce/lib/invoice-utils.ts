import { downloadCsv, toCsv } from "@/utils/csv";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";

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
    // A refunded invoice used to export its GROSS total with no column saying
    // any of it had gone back — so the CSV, which is what gets reconciled
    // against the bank and handed to an accountant, disagreed with the invoice
    // document for the same order, which does show the refund.
    "Refunded",
    "Net",
    "Placed",
  ];
  const rows = orders.map((order) => {
    // Only money the gateway confirmed leaving. A refund it has accepted but
    // not yet paid out is not something to net off a ledger.
    const refunded = settledRefundAmount(order);
    return [
      order.orderNumber,
      order.address.fullName,
      order.address.email,
      order.address.phone,
      order.status,
      order.paymentStatus,
      order.paymentReference ?? "",
      String(order.totals.total),
      String(refunded),
      String(Math.max(order.totals.total - refunded, 0)),
      order.placedAt,
    ];
  });
  const csv = toCsv([headers, ...rows]);
  downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
