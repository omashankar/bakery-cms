import {
  filterOrdersInPreviousWindow,
  filterOrdersInWindow,
  getAnalyticsWindow,
  getCityBreakdown,
  getCouponBreakdown,
  getPaymentBreakdown,
  getRecentReportOrders,
  getReportsComparison,
  getReportsSummary,
  getRevenueTrend,
  getStatusBreakdown,
  getTopCustomers,
  getTopProducts,
  type CityBreakdownItem,
  type CouponBreakdownItem,
  type PaymentBreakdownItem,
  type ReportDateRange,
  type ReportsComparison,
  type ReportsSummary,
  type RevenueTrendPoint,
  type StatusBreakdownItem,
  type TopCustomerItem,
  type TopProductItem,
} from "@/features/orders/lib/order-analytics";
import { DEFAULT_TIME_ZONE } from "@/features/orders/lib/viewer-time";
import {
  filterInvoiceOrders,
  filterRefundCases,
  getInvoiceOverview,
  getRefundOverview,
  type InvoiceListFilters,
  type InvoiceOverview,
  type RefundListFilters,
  type RefundOverview,
} from "@/features/orders/lib/order-overviews";
import {
  getPaymentAnalytics,
  type PaymentAnalytics,
} from "@/features/payments/lib/payment-analytics";
import {
  applyTransactionFilters,
  buildTransactions,
  type TransactionFilters,
  type TransactionView,
} from "@/features/payments/lib/transactions";
import type { PlacedOrder } from "@/features/orders/lib/orders";

import * as repo from "./order.repository";

/**
 * Report and dashboard analytics, computed over EVERY order in the requested
 * window.
 *
 * These used to run in the browser over a cached slice of the most recent
 * orders, so every figure silently shrank once a shop outgrew that cache. The
 * computation itself is unchanged — it calls the same pure functions the admin
 * already used — because a second implementation here would drift, and a drifted
 * revenue figure looks perfectly plausible.
 */
export interface OrderAnalytics {
  range: ReportDateRange;
  summary: ReportsSummary;
  previousSummary: ReportsSummary;
  comparison: ReportsComparison;
  trend: RevenueTrendPoint[];
  statusBreakdown: StatusBreakdownItem[];
  paymentBreakdown: PaymentBreakdownItem[];
  topProducts: TopProductItem[];
  topCustomers: TopCustomerItem[];
  cityBreakdown: CityBreakdownItem[];
  couponBreakdown: CouponBreakdownItem[];
  recentOrders: PlacedOrder[];
}

/** Comfortably above the longest list any screen renders. */
const TOP_N = 10;

/**
 * Overview counters for the refund, invoice and payment screens, over EVERY
 * order.
 *
 * One endpoint rather than three because all three are a single pass over the
 * same collection — three requests would mean loading it three times.
 */
export interface CommerceOverviews {
  refunds: RefundOverview;
  invoices: InvoiceOverview;
  payments: PaymentAnalytics;
}

export async function getCommerceOverviews(
  timeZone: string = DEFAULT_TIME_ZONE
): Promise<CommerceOverviews> {
  const orders = await repo.listSince(null);

  return {
    refunds: getRefundOverview(orders),
    invoices: getInvoiceOverview(orders),
    payments: getPaymentAnalytics(orders, timeZone),
  };
}

export async function getOrderAnalytics(
  range: ReportDateRange,
  timeZone: string = DEFAULT_TIME_ZONE
): Promise<OrderAnalytics> {
  // ONE clock reading for the whole request. Sampling the clock separately for
  // the database bound and for the in-memory filters lets them disagree: the
  // later sample produces an earlier previousStart, so the filter looks for
  // orders the query was never asked to load, and the comparison period comes
  // back short by however long the round trip took.
  const nowMs = Date.now();
  const window = getAnalyticsWindow(range, timeZone, nowMs);

  // The comparison period is the earliest thing needed, so load from there and
  // split in memory rather than querying twice.
  const orders = await repo.listSince(window.previousStart?.toISOString() ?? null);

  const current = filterOrdersInWindow(orders, window);
  const previous = filterOrdersInPreviousWindow(orders, window);
  const summary = getReportsSummary(current);
  const previousSummary = getReportsSummary(previous);

  return {
    range,
    summary,
    previousSummary,
    comparison: getReportsComparison(summary, previousSummary),
    // The trend re-filters to the current window itself, so it takes the wider
    // set. It buckets by the VIEWER's day boundary, not the server's.
    trend: getRevenueTrend(orders, range, timeZone, nowMs),
    statusBreakdown: getStatusBreakdown(current),
    paymentBreakdown: getPaymentBreakdown(current),
    // Each screen shows a different number of rows (the dashboard 4, reports 6).
    // Return a superset of the longest and let callers slice: these lists are
    // already sorted, so a slice of the top N is exactly the top N.
    topProducts: getTopProducts(current, TOP_N),
    topCustomers: getTopCustomers(current, TOP_N),
    cityBreakdown: getCityBreakdown(current, TOP_N),
    couponBreakdown: getCouponBreakdown(current, TOP_N),
    recentOrders: getRecentReportOrders(current, TOP_N),
  };
}

/**
 * A filtered, paginated slice of a commerce screen's list PLUS the overview
 * counters, both derived from ONE snapshot of the orders collection.
 *
 * Returning them together is the point: when the cards were server totals and
 * the list was the browser's capped cache, a tab could read "640" above twelve
 * rows. Same snapshot, same answer.
 */
export interface CommerceListPage<TItem, TOverview> {
  items: TItem[];
  total: number;
  overview: TOverview;
}

function paginate<T>(items: T[], page: number, limit: number): T[] {
  return items.slice((page - 1) * limit, page * limit);
}

export async function getRefundCasesPage(
  filters: RefundListFilters,
  page: number,
  limit: number
): Promise<CommerceListPage<PlacedOrder, RefundOverview>> {
  // Narrowed in the database first. Refund cases are a sparse subset, and the
  // rest of the predicate is derived rather than stored, so this is the only
  // part that can be a query — but it is the part that matters.
  const candidates = await repo.listRefundCandidates();
  const matching = filterRefundCases(candidates, filters);

  return {
    items: paginate(matching, page, limit),
    total: matching.length,
    // Counters span every case, not just the filtered ones — that is what the
    // cards have always meant, and the tabs need the unfiltered per-type counts.
    overview: getRefundOverview(candidates),
  };
}

export async function getInvoicesPage(
  filters: InvoiceListFilters,
  page: number,
  limit: number
): Promise<CommerceListPage<PlacedOrder, InvoiceOverview>> {
  const orders = await repo.listSince(null);
  const matching = filterInvoiceOrders(orders, filters);

  return {
    items: paginate(matching, page, limit),
    total: matching.length,
    overview: getInvoiceOverview(orders),
  };
}

/** Exactly the three figures the Transaction Center's cards show. */
export interface TransactionsOverview {
  /** Summed over every transaction matching the filters, not just this page. */
  filteredVolume: number;
  /** Matching transactions in a success state. */
  filteredSuccessCount: number;
  /** Every transaction, ignoring the filters — the "all time" card. */
  totalRecords: number;
}

const SUCCESS_STATUSES = ["captured", "paid", "cod_paid"];

export async function getTransactionsPage(
  filters: TransactionFilters,
  page: number,
  limit: number
): Promise<CommerceListPage<TransactionView, TransactionsOverview>> {
  const orders = await repo.listSince(null);
  // One transaction per order, so paginating the derived rows is equivalent to
  // paginating the orders — but the status and gateway filters read derived
  // fields, so the derivation has to happen before the filter, not in the query.
  const transactions = buildTransactions(orders);
  const matching = applyTransactionFilters(transactions, filters);

  return {
    items: paginate(matching, page, limit),
    total: matching.length,
    overview: {
      // Volume and success count follow the FILTERS — that is what those two
      // cards have always meant, they move as the admin narrows the list.
      // Total records deliberately does not.
      filteredVolume: matching.reduce((sum, txn) => sum + txn.amount, 0),
      filteredSuccessCount: matching.filter((txn) => SUCCESS_STATUSES.includes(txn.status))
        .length,
      totalRecords: transactions.length,
    },
  };
}
