/**
 * Client-side orders API. The storefront dual-writes placed orders to the
 * server (so the admin, on another device, sees them); the admin dual-writes
 * lifecycle changes and hydrates the full list. Never throws, so the
 * localStorage flow keeps working offline/unauthenticated.
 *
 * Every mutation resolves to whether the SERVER accepted it. Admin lifecycle
 * changes — status, cancellation, refunds — must not be reported as saved on the
 * strength of the local write alone: the server is the source of truth, so a
 * rejected write is silently undone by the next hydration.
 */
import type { OrderStatus, PaymentStatus, PlacedOrder, RefundOrderInput } from "./orders";
import type {
  CityBreakdownItem,
  CouponBreakdownItem,
  PaymentBreakdownItem,
  ReportsComparison,
  ReportsSummary,
  RevenueTrendPoint,
  StatusBreakdownItem,
  TopCustomerItem,
  TopProductItem,
} from "./order-analytics";
import type { InvoiceOverview, RefundOverview } from "./order-overviews";
import type { PaymentAnalytics } from "@/features/payments/lib/payment-analytics";
import type { TransactionView } from "@/features/payments/lib/transactions";

/** Mirrors `CommerceOverviews` from the server analytics module. */
export interface CommerceOverviewsResponse {
  refunds: RefundOverview;
  invoices: InvoiceOverview;
  payments: PaymentAnalytics;
}

/** Mirrors `OrderAnalytics` from the server analytics module. */
export interface OrderAnalyticsResponse {
  range: string;
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

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

export interface OrdersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PagedEnvelope<T> extends Envelope<T> {
  pagination: OrdersPagination | null;
}

/** Per-status counts and revenue across every order, aggregated server-side. */
export interface OrderStatsSummary {
  total: number;
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
  refunded: number;
  revenue: number;
}

export interface OrderPageQuery {
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  dateRange?: string;
  search?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  limit?: number;
}

/** The stored order out of a success envelope, or null if it cannot be read. */
async function readOrderBody(res: Response): Promise<PlacedOrder | null> {
  try {
    if (typeof res.json !== "function") return null;
    const json = (await res.json()) as { data?: PlacedOrder | null } | null;
    return json?.data ?? null;
  } catch {
    return null;
  }
}

/** 0 means the request never got an answer — offline, DNS, CORS, abort. */
async function sendWithStatus(
  path: string,
  method: string,
  body?: unknown
): Promise<{
  ok: boolean;
  status: number;
  data?: PlacedOrder | null;
  closed?: string;
  /** The server's own explanation for a refusal, when it gave one. */
  error?: string;
}> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // One read of the body, two answers out of it — a Response can only be
      // consumed once, so the maintenance marker and the plain message have to
      // come from the same parse.
      const refusal = await readRefusal(res);
      return { ok: false, status: res.status, closed: refusal.closed, error: refusal.message };
    }

    // A body we cannot read does not undo a 2xx — the order IS stored. Every
    // failure here degrades to "no data", never to "the write failed", which is
    // why the parse is isolated from the outer catch.
    const data = await readOrderBody(res);
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Resolves false on a network failure OR a non-2xx response (401, 404, 500…). */
async function send(path: string, method: string, body?: unknown): Promise<boolean> {
  return (await sendWithStatus(path, method, body)).ok;
}

/** 3 attempts, 400ms then 800ms apart. */
const PLACE_ORDER_ATTEMPTS = 3;
const PLACE_ORDER_BACKOFF_MS = 400;

/**
 * The admin's "we are closed" message, when THAT is why the write was refused.
 *
 * A closed shop answers 503, which this file otherwise treats as a transient
 * outage worth retrying. The server tags the refusal so the two can be told
 * apart without matching on prose.
 */
async function readRefusal(
  res: Response,
): Promise<{ closed?: string; message?: string }> {
  try {
    const body = (await res.json()) as {
      message?: string;
      errors?: { field?: string; message?: string }[] | null;
    };
    const marker =
      res.status === 503 ? body.errors?.find((error) => error.field === "maintenance") : undefined;
    return {
      closed: marker ? marker.message || body.message || "The store is closed." : undefined,
      message: body.message || undefined,
    };
  } catch {
    return {};
  }
}

/** A rejection the server will keep rejecting — retrying it just wastes the wait. */
function isWorthRetrying(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Confirm the order on the server, with the same id/orderNumber as the local
 * copy so the two agree.
 *
 * Retries, unlike every other write in this file, because of when it runs: the
 * card has already been charged and the cart is about to be emptied, so a single
 * dropped request would cost a paid order that the bakery never sees. The POST
 * is idempotent on the order id, so a retry after a response we never received
 * cannot create a second order or decrement stock twice.
 */
export interface PlaceOrderResponse {
  ok: boolean;
  /**
   * The order as STORED. The server owns order-number uniqueness — the number
   * this browser picked is de-duplicated only against its own history, so it
   * collides with other customers and the server may have had to issue a
   * different one. Callers must adopt this copy, or the customer walks away with
   * a confirmation number that matches nothing.
   */
  order?: PlacedOrder;
  /**
   * Set when the shop is closed for maintenance. Carries the admin's own
   * message, so the customer is told the bakery is closed rather than left
   * looking at a generic "could not reach the server".
   */
  closed?: string;
}

export async function placeOrderRequest(
  order: PlacedOrder,
  /** The cart the server priced. Sent so the server uses its own numbers. */
  draftId?: string,
): Promise<PlaceOrderResponse> {
  const body = draftId ? { ...order, draftId } : order;

  for (let attempt = 0; attempt < PLACE_ORDER_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(PLACE_ORDER_BACKOFF_MS * 2 ** (attempt - 1));

    const { ok, status, data, closed } = await sendWithStatus("/api/orders", "POST", body);
    if (ok) return { ok: true, order: data ?? undefined };
    // A closed shop will refuse every attempt. Retrying only makes the customer
    // wait out the backoff before being told the same thing.
    if (closed) return { ok: false, closed };
    if (!isWorthRetrying(status)) return { ok: false };
  }

  return { ok: false };
}

export function updateStatusRequest(orderId: string, status: OrderStatus): Promise<boolean> {
  return send(`/api/orders/${orderId}/status`, "PATCH", { status });
}

export function cancelOrderRequest(
  orderId: string,
  cancellationReason?: string,
): Promise<boolean> {
  return send(`/api/orders/${orderId}/cancel`, "POST", { cancellationReason });
}

/**
 * One order, from the SERVER, for a customer who can prove they own it.
 *
 * The storefront's order pages read `localStorage` and nothing else, which made
 * them wrong in two directions. A refund, a cancellation or a payment correction
 * never reached the customer — their copy was frozen at whatever it looked like
 * when they placed it, forever. And an order the WEBHOOK placed (the rescue path
 * for a payment whose customer closed the tab) exists only on the server, so the
 * person most in need of tracking it could not: their browser had never heard of
 * it.
 *
 * `email` is what the endpoint checks; it refuses with the same 404 as an
 * unknown number rather than confirming which order numbers exist.
 */
export async function fetchOrderByNumber(
  orderNumber: string,
  lookup: { email?: string; phone?: string },
): Promise<PlacedOrder | null> {
  const params = new URLSearchParams();
  if (lookup.email?.trim()) params.set("email", lookup.email.trim());
  if (lookup.phone?.trim()) params.set("phone", lookup.phone.trim());

  try {
    const res = await fetch(
      `/api/orders/by-number/${encodeURIComponent(orderNumber)}?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    return await readOrderBody(res);
  } catch {
    return null;
  }
}

/**
 * Refunds report WHY they were refused, unlike every other write here.
 *
 * The server has real reasons and they are all actionable: the gateway says
 * nothing is left to refund, the payment was never captured, this COD order was
 * never delivered, the gateway could not be reached. Collapsing all of that to
 * `false` produced one message — "Refund recorded on this device only — the
 * server rejected it" — which is both wrong (nothing was recorded anywhere) and
 * useless (it names no cause and suggests no action).
 */
export async function refundOrderRequest(
  orderId: string,
  input: RefundOrderInput,
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendWithStatus(`/api/orders/${orderId}/refund`, "POST", input);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

export function paymentStatusRequest(
  orderId: string,
  paymentStatus: PaymentStatus,
  paymentReference?: string,
): Promise<boolean> {
  return send(`/api/orders/${orderId}/payment`, "PATCH", { paymentStatus, paymentReference });
}

export function adminNotesRequest(orderId: string, adminNotes: string): Promise<boolean> {
  return send(`/api/orders/${orderId}/notes`, "PATCH", { adminNotes });
}

export function refundNotesRequest(orderId: string, notes: string): Promise<boolean> {
  return send(`/api/orders/${orderId}/refund-notes`, "PATCH", { notes });
}

export function requestRefundRequest(
  orderId: string,
  input: RefundOrderInput,
): Promise<boolean> {
  return send(`/api/orders/${orderId}/refund-request`, "POST", input);
}

/** Admin: fetch all orders from the server (401 → null for non-admins). */
export async function fetchOrders(): Promise<PlacedOrder[] | null> {
  try {
    const res = await fetch("/api/orders", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<PlacedOrder[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Admin: one filtered, sorted page of orders straight from the server, with the
 * total matching count.
 *
 * The admin list reads this rather than filtering the localStorage cache: that
 * cache only ever holds the most recent slice, so anything older than it was
 * both unreachable and silently missing from the counts.
 */
export async function fetchOrdersPage(
  query: OrderPageQuery,
): Promise<{ items: PlacedOrder[]; pagination: OrdersPagination | null } | null> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  try {
    const res = await fetch(`/api/orders?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as PagedEnvelope<PlacedOrder[]>;
    if (!json.success || !json.data) return null;
    return { items: json.data, pagination: json.pagination };
  } catch {
    return null;
  }
}

/**
 * Admin: report/dashboard analytics over every order in the range.
 *
 * Sends the browser's timezone offset so daily and monthly buckets follow the
 * admin's calendar rather than the server's.
 */
export async function fetchOrderAnalytics(
  range: string,
): Promise<OrderAnalyticsResponse | null> {
  const params = new URLSearchParams({
    range,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  try {
    const res = await fetch(`/api/orders/analytics?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<OrderAnalyticsResponse>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Admin: refund/invoice/payment overview counters over every order.
 *
 * The three screens that show these were counting the local order cache, which
 * only ever holds the most recent slice — so each card was a total that was
 * quietly too small.
 */
export async function fetchCommerceOverviews(): Promise<CommerceOverviewsResponse | null> {
  const params = new URLSearchParams({
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  try {
    const res = await fetch(`/api/orders/overviews?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<CommerceOverviewsResponse>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Admin: counts + revenue over the whole collection (not just the loaded page). */
export async function fetchOrderStats(): Promise<OrderStatsSummary | null> {
  try {
    const res = await fetch("/api/orders/stats", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<OrderStatsSummary>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Admin: fetch a single order from the server by id. Used as a cache-miss
 * fallback so a deep link (or an order placed on another device) resolves from
 * the backend instead of flashing "Order not found" before the list hydrates.
 */
export async function fetchOrder(orderId: string): Promise<PlacedOrder | null> {
  try {
    const res = await fetch(`/api/orders/${orderId}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<PlacedOrder>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** A commerce list screen's page: rows, the total match count, and its counters. */
export interface CommerceListPageResponse<TItem, TOverview> {
  items: TItem[];
  total: number;
  overview: TOverview;
}

async function fetchListPage<T>(path: string, query: Record<string, unknown>): Promise<T | null> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  try {
    const res = await fetch(`${path}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Admin: refund cases, invoices and transactions — each a filtered page over
 * EVERY order, returned with its counters from the same snapshot.
 *
 * These lists cannot be served by the generic `/api/orders` filter set: a refund
 * case's status, its reason fallback and its activity date are all derived from
 * `status` + `refundRecord` together, and a transaction's status group is
 * derived too. None of them is a stored field to query on.
 */
export const fetchRefundCasesPage = (query: Record<string, unknown>) =>
  fetchListPage<CommerceListPageResponse<PlacedOrder, RefundOverview>>(
    "/api/orders/refund-cases",
    query,
  );

export const fetchInvoicesPage = (query: Record<string, unknown>) =>
  fetchListPage<CommerceListPageResponse<PlacedOrder, InvoiceOverview>>(
    "/api/orders/invoices",
    query,
  );

/** Mirrors `TransactionsOverview` from the server analytics module. */
export interface TransactionsOverviewResponse {
  filteredVolume: number;
  filteredSuccessCount: number;
  totalRecords: number;
}

export const fetchTransactionsPage = (query: Record<string, unknown>) =>
  fetchListPage<CommerceListPageResponse<TransactionView, TransactionsOverviewResponse>>(
    "/api/orders/transactions",
    query,
  );
