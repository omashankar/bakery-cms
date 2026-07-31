/**
 * Customer records and profiles, derived from orders.
 *
 * A customer is not stored anywhere — they exist only as the sum of their
 * orders. That makes a cap on the order set uniquely damaging here: it does not
 * shorten the customer list gracefully, it deletes older customers outright and
 * understates the spend of everyone who survives. So this lives in the domain
 * layer and the SERVER runs it over every order.
 *
 * Nothing in here reads storage or the clock directly — orders and admin
 * metadata are passed in, so the same functions produce the same answer on
 * either side of the wire.
 */
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import type {
  CustomerAdminMeta,
  CustomerFavoriteProduct,
  CustomerSegment,
} from "@/types/customer";

export interface CustomerRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  lastOrderNumber: string;
}

/**
 * Admin-managed metadata, stored separately from the orders it hangs off.
 *
 * `blocked` is optional because only the server persists it — the client's
 * tag/notes helpers round-trip the rest and never see it.
 */
export interface CustomerMeta extends CustomerAdminMeta {
  blocked?: boolean;
}

export interface CustomerProfile extends CustomerRecord {
  segment: CustomerSegment;
  averageOrderValue: number;
  firstOrderAt: string;
  firstOrderNumber: string;
  preferredPaymentMethod: string;
  cities: string[];
  favoriteProducts: CustomerFavoriteProduct[];
  deliveredOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  activeOrders: number;
  meta: CustomerMeta;
}

/** Statuses that do not count towards spend-derived figures. */
const UNCOUNTABLE_STATUSES = new Set(["cancelled", "refunded"]);

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

/** The grouping key — trimmed and lowercased, matching how meta rows are keyed. */
export function customerKey(email: string): string {
  return email.trim().toLowerCase();
}

export function emptyCustomerMeta(email: string, updatedAt: string): CustomerMeta {
  return {
    email,
    tags: [],
    notes: "",
    marketingOptIn: true,
    blocked: false,
    updatedAt,
  };
}

/**
 * What this customer's order is really worth to the shop.
 *
 * `totalSpent` used to accumulate `totals.total` for EVERY order with no status
 * test — even though this same file defines `UNCOUNTABLE_STATUSES` and applies
 * it in two other places. So a customer who cancelled a ₹10,000 wedding cake, or
 * had it fully refunded, still counted as having spent ₹10,000: on the Customers
 * list's "Lifetime revenue" card, on their own "Lifetime value", and in
 * `deriveCustomerSegment`, which then promoted them to a VIP tier on money the
 * shop does not have.
 */
function countableSpend(order: PlacedOrder): number {
  if (UNCOUNTABLE_STATUSES.has(order.status)) return 0;
  // A partial refund leaves the order in its fulfilment status, so it is not
  // caught above — subtract what went back.
  return Math.max(0, order.totals.total - settledRefundAmount(order));
}

export function buildCustomerRecords(orders: PlacedOrder[]): CustomerRecord[] {
  const map = new Map<string, CustomerRecord>();

  for (const order of orders) {
    const email = customerKey(order.address?.email ?? "");
    if (!email) continue;

    const existing = map.get(email);
    if (!existing) {
      map.set(email, {
        id: email,
        email: order.address.email,
        name: order.address.fullName,
        phone: order.address.phone,
        orderCount: 1,
        totalSpent: countableSpend(order),
        lastOrderAt: order.placedAt,
        lastOrderNumber: order.orderNumber,
      });
      continue;
    }

    const isNewer =
      new Date(order.placedAt).getTime() > new Date(existing.lastOrderAt).getTime();

    map.set(email, {
      ...existing,
      name: order.address.fullName || existing.name,
      phone: order.address.phone || existing.phone,
      orderCount: existing.orderCount + 1,
      totalSpent: existing.totalSpent + countableSpend(order),
      lastOrderAt: isNewer ? order.placedAt : existing.lastOrderAt,
      lastOrderNumber: isNewer ? order.orderNumber : existing.lastOrderNumber,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
  );
}

export function deriveCustomerSegment(
  customer: CustomerRecord,
  nowMs = Date.now()
): CustomerSegment {
  if (customer.orderCount >= 5 || customer.totalSpent >= 5000) return "vip";

  const days = Math.floor((nowMs - new Date(customer.lastOrderAt).getTime()) / 86_400_000);
  if (days > 90) return customer.orderCount >= 2 ? "at_risk" : "inactive";
  if (customer.orderCount === 1) return "new";
  return "returning";
}

function getFavoriteProducts(orders: PlacedOrder[]): CustomerFavoriteProduct[] {
  const map = new Map<string, CustomerFavoriteProduct>();

  for (const order of orders) {
    if (UNCOUNTABLE_STATUSES.has(order.status)) continue;

    for (const item of order.items) {
      const current = map.get(item.productSlug) ?? {
        slug: item.productSlug,
        name: item.name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity;
      map.set(item.productSlug, current);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

function getPreferredPaymentMethod(orders: PlacedOrder[]): string {
  const counts = new Map<string, number>();
  for (const order of orders) {
    counts.set(order.paymentMethod, (counts.get(order.paymentMethod) ?? 0) + 1);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return "—";

  const [method] = top;
  if (method === "cod") return "Cash on Delivery";
  if (method === "upi") return "UPI";
  if (method === "card") return "Card";
  return method.toUpperCase();
}

function getCustomerCities(orders: PlacedOrder[]): string[] {
  return [...new Set(orders.map((order) => order.address?.city).filter(Boolean))].slice(0, 6);
}

/**
 * Full profiles for every customer in `orders`.
 *
 * Groups once and walks each customer's own orders, rather than re-scanning the
 * whole set per customer — the caller may be handing over the entire collection.
 */
export function buildCustomerProfiles(
  orders: PlacedOrder[],
  metaFor: (key: string) => CustomerMeta | undefined,
  nowMs = Date.now()
): CustomerProfile[] {
  const byCustomer = new Map<string, PlacedOrder[]>();
  for (const order of orders) {
    const key = customerKey(order.address?.email ?? "");
    if (!key) continue;
    const bucket = byCustomer.get(key);
    if (bucket) bucket.push(order);
    else byCustomer.set(key, [order]);
  }

  return buildCustomerRecords(orders).map((customer) => {
    const own = (byCustomer.get(customer.id) ?? [])
      .slice()
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
    const countable = own.filter((order) => !UNCOUNTABLE_STATUSES.has(order.status));
    const first = own[own.length - 1] ?? null;

    return {
      ...customer,
      segment: deriveCustomerSegment(customer, nowMs),
      averageOrderValue:
        countable.length > 0 ? Math.round(customer.totalSpent / countable.length) : 0,
      firstOrderAt: first?.placedAt ?? customer.lastOrderAt,
      firstOrderNumber: first?.orderNumber ?? customer.lastOrderNumber,
      preferredPaymentMethod: getPreferredPaymentMethod(own),
      cities: getCustomerCities(own),
      favoriteProducts: getFavoriteProducts(own),
      deliveredOrders: own.filter((order) => order.status === "delivered").length,
      cancelledOrders: own.filter((order) => order.status === "cancelled").length,
      refundedOrders: own.filter((order) => order.status === "refunded").length,
      activeOrders: own.filter((order) => ACTIVE_STATUSES.includes(order.status)).length,
      meta:
        metaFor(customer.id) ??
        emptyCustomerMeta(customer.email, new Date(nowMs).toISOString()),
    };
  });
}
