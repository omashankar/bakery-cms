import mongoose from "mongoose";

import { connectDB } from "@/lib/server/db/mongoose";
import { OrderModel, type OrderDoc } from "@/lib/server/db/models/order.model";
import { ProductModel } from "@/lib/server/db/models/product.model";
import type { OrderStatus, PaymentStatus, PlacedOrder } from "@/features/orders/lib/orders";

/** Order repository — the only place that touches the orders collection. */

type Raw = OrderDoc & { __v?: number };

function toDoc(order: PlacedOrder): OrderDoc {
  const { id, ...rest } = order;
  return { _id: id, ...rest } as OrderDoc;
}

function toOrder(raw: Raw): PlacedOrder {
  const { _id, __v, ...rest } = raw as Record<string, unknown>;
  void __v;
  return { ...rest, id: String(_id) } as PlacedOrder;
}

export interface StockReduction {
  slug: string;
  quantity: number;
}

/**
 * Place an order and reduce product stock ATOMICALLY. If any write fails the
 * whole thing rolls back — no order without its stock decrement, and no stock
 * decrement without its order. This is the flagship transactional path.
 * Unlimited-stock products are skipped by the filter.
 */
/** Mongo's duplicate-key error — this `_id` is already in the collection. */
const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    errorResponse?: { code?: unknown };
    message?: unknown;
  };

  // Three shapes because a transaction can wrap the driver error before it gets
  // here. Getting this wrong is safe in only one direction: an unrecognised
  // duplicate rethrows, the client sees a 500 and reports the order unconfirmed
  // — wrong, but recoverable. Mistaking another error for a duplicate would
  // report an order saved that was not, so the test is specific.
  return (
    candidate.code === DUPLICATE_KEY ||
    candidate.errorResponse?.code === DUPLICATE_KEY ||
    (typeof candidate.message === "string" && candidate.message.includes("E11000"))
  );
}

export interface CreateOrderResult {
  order: PlacedOrder;
  /** False when this id was already present, i.e. the caller is retrying. */
  created: boolean;
}

export async function createOrderWithStockReduction(
  order: PlacedOrder,
  reductions: StockReduction[],
): Promise<CreateOrderResult> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await OrderModel.create([toDoc(order)], { session });
      for (const r of reductions) {
        if (!r.slug || r.quantity <= 0) continue;
        await ProductModel.updateOne(
          { slug: r.slug, unlimitedStock: { $ne: true } },
          { $inc: { stockQuantity: -r.quantity } },
          { session },
        );
      }
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // The storefront is retrying a POST whose response it never saw. The
    // transaction aborted as a unit, so stock was NOT decremented a second
    // time; the order from the first attempt is already here. Report the stored
    // copy rather than an error — the alternative tells a customer who has
    // already paid that their order failed.
    const existing = await findById(order.id);
    return { order: existing ?? order, created: false };
  } finally {
    await session.endSession();
  }
  return { order, created: true };
}

export async function findById(id: string): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findById(id).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

/**
 * The order a gateway payment already bought, if any.
 *
 * Backs the "one payment, one order" guard. Deliberately not restricted to a
 * time window: a duplicate a day later is still a duplicate, and the reference
 * comes from the gateway, so it is unique per capture.
 */
export async function findByPaymentReference(reference: string): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOne({ paymentReference: reference })
    .sort({ placedAt: 1 })
    .lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function findByNumber(orderNumber: string): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOne({ orderNumber }).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function findByCustomerEmail(email: string): Promise<PlacedOrder[]> {
  await connectDB();
  // Orders store the address exactly as the customer typed it, so an exact match
  // on the lowercased key finds nothing for anyone who capitalised their email —
  // they appear in the customers list (which groups case-insensitively) but
  // their detail page comes back empty. Match case-insensitively instead.
  const key = escapeRegex(email.trim());
  const docs = (await OrderModel.find({
    "address.email": { $regex: `^${key}$`, $options: "i" },
  })
    .sort({ placedAt: -1 })
    .lean()) as unknown as Raw[];
  return docs.map(toOrder);
}

/**
 * Every order placed at or after `sinceIso` (all of them when null), newest
 * first and UNCAPPED.
 *
 * This backs the analytics endpoints. It is deliberately not limited: a cap here
 * is exactly the bug being fixed — it does not fail, it just quietly returns a
 * smaller revenue figure than the truth. The volume is bounded instead by the
 * caller's date range, which is how the admin already thinks about reports.
 */
export async function listSince(sinceIso: string | null): Promise<PlacedOrder[]> {
  await connectDB();
  const filter = sinceIso ? { placedAt: { $gte: sinceIso } } : {};
  const docs = (await OrderModel.find(filter)
    .sort({ placedAt: -1 })
    .lean()) as unknown as Raw[];
  return docs.map(toOrder);
}

/**
 * Only the orders that could possibly be a refund case, newest first.
 *
 * This is `isRefundCase` expressed as a query — the one part of the refund
 * predicate that IS a stored field. The rest (case status, reason fallback,
 * activity date) is derived and still has to run in JS, but it now runs over the
 * handful of cancelled/refunded orders instead of the entire collection.
 */
export async function listRefundCandidates(): Promise<PlacedOrder[]> {
  await connectDB();
  const docs = (await OrderModel.find({
    $or: [
      { status: { $in: ["cancelled", "refunded"] } },
      { refundRecord: { $exists: true, $ne: null } },
    ],
  })
    .sort({ placedAt: -1 })
    .lean()) as unknown as Raw[];
  return docs.map(toOrder);
}

/** Statuses each delivery filter accepts — mirrors the admin list's client filter. */
const DELIVERY_STATUSES: Record<string, OrderStatus[]> = {
  pending: ["pending", "confirmed", "preparing", "ready"],
  in_progress: ["pending", "confirmed", "preparing", "ready", "out_for_delivery"],
  in_transit: ["out_for_delivery"],
  delivered: ["delivered"],
};

const DATE_RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Escape a user string so it cannot inject regex operators into the query. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface OrderListQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: string;
  dateRange?: string;
  search?: string;
  amountMin?: number;
  amountMax?: number;
  page: number;
  limit: number;
}

/** Exported for tests — pure, and the intersection/escaping rules are subtle. */
export function buildOrderFilter(q: OrderListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // `status` and `deliveryStatus` both constrain the same field, and the admin
  // list applies them together — so intersect rather than letting one win.
  const constraints: OrderStatus[][] = [];
  if (q.status) constraints.push([q.status]);
  const delivery = q.deliveryStatus ? DELIVERY_STATUSES[q.deliveryStatus] : undefined;
  if (delivery) constraints.push(delivery);
  if (constraints.length > 0) {
    const allowed = constraints.reduce((a, b) => a.filter((s) => b.includes(s)));
    filter.status = { $in: allowed };
  }

  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;

  const days = q.dateRange ? DATE_RANGE_DAYS[q.dateRange] : undefined;
  if (days) {
    // placedAt is stored as an ISO string, which compares correctly lexically.
    filter.placedAt = { $gte: new Date(Date.now() - days * 86_400_000).toISOString() };
  }

  if (q.amountMin !== undefined || q.amountMax !== undefined) {
    const total: Record<string, number> = {};
    if (q.amountMin !== undefined) total.$gte = q.amountMin;
    if (q.amountMax !== undefined) total.$lte = q.amountMax;
    filter["totals.total"] = total;
  }

  if (q.search) {
    const rx = { $regex: escapeRegex(q.search), $options: "i" };
    filter.$or = [
      { orderNumber: rx },
      { "address.fullName": rx },
      { "address.email": rx },
      { "address.phone": rx },
    ];
  }

  return filter;
}

/** Filtered, sorted, paginated page of orders plus the total matching count. */
export async function list(q: OrderListQuery): Promise<{ items: PlacedOrder[]; total: number }> {
  await connectDB();

  const filter = buildOrderFilter(q);
  const skip = (q.page - 1) * q.limit;

  const [docs, total] = await Promise.all([
    OrderModel.find(filter).sort({ placedAt: -1 }).skip(skip).limit(q.limit).lean(),
    OrderModel.countDocuments(filter),
  ]);

  return { items: (docs as unknown as Raw[]).map(toOrder), total };
}

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

/**
 * Per-status counts and revenue across the WHOLE collection, computed in Mongo.
 *
 * The admin's stat cards and status tabs used to count a client-side array that
 * was capped at the most recent 500 orders, so past that point every figure was
 * quietly wrong. An aggregation has no such ceiling and moves no documents over
 * the wire.
 */
export async function stats(): Promise<OrderStatsSummary> {
  await connectDB();

  const rows = (await OrderModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totals.total" } } },
  ])) as Array<{ _id: OrderStatus | null; count: number; revenue: number }>;

  const summary: OrderStatsSummary = {
    total: 0,
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    outForDelivery: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
    revenue: 0,
  };

  const key: Record<string, keyof OrderStatsSummary> = {
    pending: "pending",
    confirmed: "confirmed",
    preparing: "preparing",
    ready: "ready",
    out_for_delivery: "outForDelivery",
    delivered: "delivered",
    cancelled: "cancelled",
    refunded: "refunded",
  };

  for (const row of rows) {
    summary.total += row.count;
    const field = row._id ? key[row._id] : undefined;
    if (field) summary[field] = row.count;
    // Revenue excludes cancelled and refunded — same rule as the client's
    // getOrderStats, so the two can never disagree.
    if (row._id !== "cancelled" && row._id !== "refunded") {
      summary.revenue += row.revenue ?? 0;
    }
  }

  return summary;
}

export async function patch(id: string, fields: Partial<PlacedOrder>): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findByIdAndUpdate(
    id,
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function orderNumberExists(orderNumber: string): Promise<boolean> {
  await connectDB();
  return (await OrderModel.exists({ orderNumber })) !== null;
}
