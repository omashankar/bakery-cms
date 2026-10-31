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
  range: ReportDateRange,
  /**
   * False for a member without the revenue permission. Their figures arrive
   * with every amount zeroed, and a file of "Revenue 0" columns would read as
   * a shop that sold nothing — so the money is left out, not printed as 0.
   */
  money = true,
): void {
  if (typeof window === "undefined") return;

  // The shop's name, not the software's. This export goes to the owner's
  // accountant carrying revenue, top customers and their email addresses, and
  // it was headed with the vendor — identifying every business except the one
  // whose figures these are. It is the only export in the repo that stamps a
  // brand at all.
  const shopName = getGeneralSettings().siteName?.trim();

  /** A row, with its money cells dropped when the member may not see money. */
  const row = (cells: (string | null)[]) => cells.filter((cell): cell is string => cell !== null);
  const amount = (value: number) => (money ? String(value) : null);
  const heading = (label: string) => (money ? label : null);

  const lines = [
    [shopName ? `${shopName} — Reports Export` : "Reports Export"],
    ["Range", range],
    ["Generated", new Date().toISOString()],
    [],
    ["Summary Metric", "Value"],
    ...(money ? [["Revenue", String(summary.revenue)]] : []),
    ["Orders", String(summary.orders)],
    ...(money ? [["Average Order Value", String(summary.averageOrderValue)]] : []),
    ["Items Sold", String(summary.itemsSold)],
    ["Active Orders", String(summary.activeOrders)],
    ["Unique Customers", String(summary.uniqueCustomers)],
    ["Delivered", String(summary.delivered)],
    ["Cancelled", String(summary.cancelled)],
    ["Refunded", String(summary.refunded)],
    ...(money
      ? [
          ["Coupon Discount", String(summary.couponDiscount)],
          ["Delivery Fees", String(summary.deliveryFees)],
          ["Tax Collected", String(summary.taxCollected)],
        ]
      : []),
    ["COD Orders", String(summary.codOrders)],
    ["Prepaid Orders", String(summary.prepaidOrders)],
    [],
    row(["Top Products", "Quantity", heading("Revenue")]),
    ...products.map((item) => row([item.name, String(item.quantity), amount(item.revenue)])),
    [],
    row(["Top Customers", "Orders", heading("Revenue"), "Email"]),
    ...customers.map((item) => row([item.name, String(item.orders), amount(item.revenue), item.email])),
    [],
    row(["Cities", "Orders", heading("Revenue")]),
    ...cities.map((item) => row([item.city, String(item.orders), amount(item.revenue)])),
    [],
    row(["Coupons", "Uses", heading("Discount")]),
    ...coupons.map((item) => row([item.code, String(item.uses), amount(item.discount)])),
    [],
    row(["Payments", "Orders", heading("Revenue")]),
    ...payments.map((item) => row([item.label, String(item.count), amount(item.revenue)])),
  ];

  const csv = toCsv(lines);

  const slug =
    shopName?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reports";
  downloadCsv(`${slug}-reports-${range}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
