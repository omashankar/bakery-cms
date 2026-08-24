import { downloadCsv, toCsv } from "@/utils/csv";
import { getGeneralSettings } from "@/features/settings/lib/settings-repository";
/**
 * Admin-side entry point for report analytics.
 *
 * The maths lives in `features/orders/lib/order-analytics` so the server can run
 * the exact same functions over the whole orders collection — the admin's
 * figures used to be computed here over a browser cache that only ever held the
 * most recent slice, which made every total quietly wrong past that point.
 *
 * Re-exported rather than moved outright so existing import paths keep working.
 * What stays here is the browser-only part: reading the local cache and writing
 * a CSV download.
 */
import type {
  CityBreakdownItem,
  CouponBreakdownItem,
  PaymentBreakdownItem,
  ReportDateRange,
  ReportsSummary,
  TopCustomerItem,
  TopProductItem,
} from "@/features/orders/lib/order-analytics";

export type {
  CityBreakdownItem,
  CouponBreakdownItem,
  PaymentBreakdownItem,
  ReportDateRange,
  ReportDelta,
  ReportsComparison,
  ReportsSummary,
  RevenueTrendPoint,
  StatusBreakdownItem,
  TopCustomerItem,
  TopProductItem,
} from "@/features/orders/lib/order-analytics";

export {
  filterOrdersByPreviousRange,
  filterOrdersByRange,
  formatReportDelta,
  getCityBreakdown,
  getCouponBreakdown,
  getPaymentBreakdown,
  getRangeStart,
  getRecentReportOrders,
  getReportsComparison,
  getReportsSummary,
  getRevenueTrend,
  getStatusBreakdown,
  getTopCustomers,
  getTopProducts,
} from "@/features/orders/lib/order-analytics";

export function exportReportsCsv(
  summary: ReportsSummary,
  products: TopProductItem[],
  customers: TopCustomerItem[],
  cities: CityBreakdownItem[],
  coupons: CouponBreakdownItem[],
  payments: PaymentBreakdownItem[],
  range: ReportDateRange
): void {
  if (typeof window === "undefined") return;

  // The shop's name, not the software's. This export goes to the owner's
  // accountant carrying revenue, top customers and their email addresses, and
  // it was headed with the vendor — identifying every business except the one
  // whose figures these are. It is the only export in the repo that stamps a
  // brand at all.
  const shopName = getGeneralSettings().siteName?.trim();

  const lines = [
    [shopName ? `${shopName} — Reports Export` : "Reports Export"],
    ["Range", range],
    ["Generated", new Date().toISOString()],
    [],
    ["Summary Metric", "Value"],
    ["Revenue", String(summary.revenue)],
    ["Orders", String(summary.orders)],
    ["Average Order Value", String(summary.averageOrderValue)],
    ["Items Sold", String(summary.itemsSold)],
    ["Active Orders", String(summary.activeOrders)],
    ["Unique Customers", String(summary.uniqueCustomers)],
    ["Delivered", String(summary.delivered)],
    ["Cancelled", String(summary.cancelled)],
    ["Refunded", String(summary.refunded)],
    ["Coupon Discount", String(summary.couponDiscount)],
    ["Delivery Fees", String(summary.deliveryFees)],
    ["Tax Collected", String(summary.taxCollected)],
    ["COD Orders", String(summary.codOrders)],
    ["Prepaid Orders", String(summary.prepaidOrders)],
    [],
    ["Top Products", "Quantity", "Revenue"],
    ...products.map((item) => [item.name, String(item.quantity), String(item.revenue)]),
    [],
    ["Top Customers", "Orders", "Revenue", "Email"],
    ...customers.map((item) => [
      item.name,
      String(item.orders),
      String(item.revenue),
      item.email,
    ]),
    [],
    ["Cities", "Orders", "Revenue"],
    ...cities.map((item) => [item.city, String(item.orders), String(item.revenue)]),
    [],
    ["Coupons", "Uses", "Discount"],
    ...coupons.map((item) => [item.code, String(item.uses), String(item.discount)]),
    [],
    ["Payments", "Orders", "Revenue"],
    ...payments.map((item) => [item.label, String(item.count), String(item.revenue)]),
  ];

  const csv = toCsv(lines);

  const slug =
    shopName?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reports";
  downloadCsv(`${slug}-reports-${range}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
