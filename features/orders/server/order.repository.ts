import { withStableLineIds } from "@/features/cart/lib/cart";
import mongoose from "mongoose";

import { connectDB } from "@/lib/server/db/mongoose";
import { OrderModel, type OrderDoc } from "@/lib/server/db/models/order.model";
import { ProductModel } from "@/lib/server/db/models/product.model";
import type { OrderStatus, PaymentStatus, PlacedOrder } from "@/features/orders/lib/orders";

/** Order repository — the only place that touches the orders collection. */

/**
 * A line could not be reserved. Thrown from inside the transaction so the order
 * is unwound with it — the alternative is an order for stock the shop does not
 * have, which is worse than a refused checkout.
 */
export class OutOfStockError extends Error {
  readonly productName: string;
  readonly available: number;

  constructor(productName: string, available: number) {
    super(
      available > 0
        ? `Only ${available} left of ${productName}.`
        : `${productName} is out of stock.`,
    );
    this.name = "OutOfStockError";
    this.productName = productName;
    this.available = available;
  }
}

type Raw = OrderDoc & { __v?: number };

function toDoc(order: PlacedOrder): OrderDoc {
  const { id, ...rest } = order;
  return { _id: id, ...rest } as OrderDoc;
}

/**
 * Repaired on read, like the settings migration.
 *
 * Orders placed before the priced line carried an `id` are in the database with
 * items that have none, and tightening a type never touches data at rest.
 * Filling it here means every server read — the detail page, the invoice, the
 * customer's own order list — sees the same repaired order, rather than each
 * screen inventing a fallback key of its own.
 *
 * Not written back: the value is derived from the line and is identical every
 * time, so persisting it would only add a way for the two to disagree.
 */
function toOrder(raw: Raw): PlacedOrder {
  const { _id, __v, ...rest } = raw as Record<string, unknown>;
  void __v;
  const order = { ...rest, id: String(_id) } as PlacedOrder;
  return order.items ? { ...order, items: withStableLineIds(order.items) } : order;
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
/** Mongo's duplicate-key error code. */
const DUPLICATE_KEY = 11000;

/**
 * WHICH unique index rejected the insert — the distinction is the whole point.
 *
 * The orders collection has two: `_id` and `orderNumber`. They mean opposite
 * things here. An `_id` collision is the same order arriving twice, i.e. a
 * retry. An `orderNumber` collision is a DIFFERENT order that happens to have
 * picked a number already in use — and the storefront picks its own number
 * de-duplicated only against that browser's localStorage, where a ~43% clash
 * after 100 orders is expected (see generateOrderNumber in orders.ts).
 *
 * Treating the second as the first is how a paid order gets reported "placed"
 * and never stored: the row was never inserted, the id lookup finds nothing, and
 * the caller is handed back the very object it sent.
 */
function duplicateKeyField(error: unknown): "id" | "orderNumber" | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as {
    code?: unknown;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    errorResponse?: { code?: unknown; keyPattern?: Record<string, unknown> };
    message?: unknown;
  };

  const isDuplicate =
    candidate.code === DUPLICATE_KEY || candidate.errorResponse?.code === DUPLICATE_KEY;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  if (!isDuplicate && !message.includes("E11000")) return null;

  const keys = {
    ...(candidate.errorResponse?.keyPattern ?? {}),
    ...(candidate.keyPattern ?? {}),
    ...(candidate.keyValue ?? {}),
  };
  if ("orderNumber" in keys) return "orderNumber";
  if ("_id" in keys) return "id";

  // The driver did not say which index. The message names it, e.g.
  // `E11000 duplicate key error collection: bakery.orders index: orderNumber_1`.
  if (message.includes("orderNumber")) return "orderNumber";
  if (message.includes("_id_")) return "id";

  // Unattributable. Rethrow rather than guess: a wrong "id" guess reports a
  // paid order saved when it was not, which is the failure this whole change
  // exists to prevent. A 500 here is wrong but recoverable.
  return null;
}

export type CreateOrderOutcome =
  /** Inserted now. */
  | { kind: "created"; order: PlacedOrder }
  /** This id was already stored — the caller is retrying. */
  | { kind: "already-placed"; order: PlacedOrder }
  /** A DIFFERENT order owns this orderNumber. The caller must pick another. */
  | { kind: "order-number-taken" };

export async function createOrderWithStockReduction(
  order: PlacedOrder,
  reductions: StockReduction[],
  /**
   * Take the order even if a line cannot be reserved.
   *
   * Set when the gateway has CONFIRMED the money was captured. Refusing then
   * would leave a customer charged with no order and a retry that can never
   * succeed — strictly worse than a shop that oversold by one cake and can ring
   * the customer. Unpaid and COD orders are refused instead, which is what stops
   * an anonymous caller driving the whole catalogue negative.
   *
   * The proper fix is to reserve stock BEFORE payment, which needs the
   * quote/draft step this architecture does not have yet.
   */
  allowOversell = false,
): Promise<CreateOrderOutcome> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await OrderModel.create([toDoc(order)], { session });
      for (const r of reductions) {
        if (!r.slug || r.quantity <= 0) continue;
        const result = await ProductModel.updateOne(
          {
            slug: r.slug,
            unlimitedStock: { $ne: true },
            // The filter used to be slug + unlimitedStock alone, so the
            // decrement ALWAYS applied and drove `stockQuantity` negative. This
            // endpoint is anonymous, so the whole catalogue could be pushed
            // below zero — and nothing anywhere adds stock back, so it stayed
            // there. Matching on availability makes the check and the decrement
            // one atomic step, which is also what stops two concurrent orders
            // from both selling the last cake.
            stockQuantity: { $gte: r.quantity },
          },
          { $inc: { stockQuantity: -r.quantity } },
          { session },
        );

        if (result.matchedCount === 0) {
          // Either the product is unlimited, gone, or there is not enough of it.
          const product = (await ProductModel.findOne({ slug: r.slug })
            .select({ name: 1, unlimitedStock: 1, stockQuantity: 1 })
            .session(session)
            .lean()) as { name?: string; unlimitedStock?: boolean; stockQuantity?: number } | null;

          if (product?.unlimitedStock) continue;

          if (allowOversell) {
            // Paid for. Take the order, go negative, and make the shortfall
            // loud — an operator has to call this customer.
            await ProductModel.updateOne(
              { slug: r.slug, unlimitedStock: { $ne: true } },
              { $inc: { stockQuantity: -r.quantity } },
              { session },
            );
            console.error(
              `[orders] OVERSOLD ${r.slug} on paid order ${order.orderNumber}: wanted ${r.quantity}, had ${product?.stockQuantity ?? 0}`,
            );
            continue;
          }

          // Not paid: refuse. Aborting the transaction unwinds the order with
          // it, so nothing is recorded for stock the shop does not have.
          throw new OutOfStockError(product?.name ?? r.slug, product?.stockQuantity ?? 0);
        }
      }
    });
  } catch (error) {
    const field = duplicateKeyField(error);
    if (field === null) throw error;
    if (field === "orderNumber") return { kind: "order-number-taken" };

    // The storefront is retrying a POST whose response it never saw. The
    // transaction aborted as a unit, so stock was NOT decremented a second
    // time; the order from the first attempt is already here. Report the stored
    // copy rather than an error — the alternative tells a customer who has
    // already paid that their order failed.
    const existing = await findById(order.id);
    // No stored row behind an `_id` duplicate should be impossible, but if the
    // read fails we must not answer "saved" on the strength of the payload we
    // were handed. Rethrowing surfaces it as a failure, which is the safe side.
    if (!existing) throw error;
    return { kind: "already-placed", order: existing };
  } finally {
    await session.endSession();
  }
  return { kind: "created", order };
}

/**
 * Puts the stock an order reserved back on the shelf.
 *
 * There was exactly one `$inc` on `stockQuantity` in the whole repo and it was
 * negative — so every cancellation and every refund destroyed inventory
 * permanently. A shop that cancelled a mistaken order watched its own stock
 * count fall with no way to raise it except editing each product by hand.
 *
 * Idempotent at the caller: `cancel` and `refund` both return early once the
 * order already holds that status, so the restore cannot run twice.
 */
export async function restoreStock(reductions: StockReduction[]): Promise<void> {
  await connectDB();
  for (const r of reductions) {
    if (!r.slug || r.quantity <= 0) continue;
    await ProductModel.updateOne(
      { slug: r.slug, unlimitedStock: { $ne: true } },
      { $inc: { stockQuantity: r.quantity } },
    );
  }
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
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        // What the shop KEPT, not what it billed.
        //
        // This summed `totals.total` and then excluded whole statuses. But an
        // order only becomes `refunded` when the refund is BOTH full and
        // settled, so a partial refund leaves it `delivered` forever — and its
        // full total kept counting. A ₹2,000 order refunded ₹1,500 for a quality
        // complaint reported ₹2,000 of revenue against ₹500 actually kept, on
        // this card and in every report.
        //
        // The transactions aggregation already nets `amount - refundedAmount`;
        // this one did not, so the two screens disagreed about the same money.
        revenue: {
          $sum: {
            $subtract: [
              { $ifNull: ["$totals.total", 0] },
              { $ifNull: ["$refundRecord.amount", 0] },
            ],
          },
        },
      },
    },
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

/**
 * Write a refund record only if nobody else has written one since we looked.
 *
 * Guarded on `refundRecord.version`, a counter bumped by every writer. The
 * obvious alternatives both have blind spots: the SIZE of `gatewayRefunds` does
 * not change when the refund webhook promotes an entry from `pending` to
 * `processed` in place, so a slow `refund()` holding a stale array would
 * silently overwrite that confirmation and the order would never settle; and it
 * does not change for an offline cash refund either, so two of those would both
 * match and one payout would go unrecorded. A version counter moves on every
 * write by construction, which is the property actually needed.
 *
 * Callers pass the version they read. A missing version (records written before
 * this existed) reads as 0.
 *
 * (Razorpay itself caps the total refundable, so losing this race cannot cause a
 * double gateway payout — the danger is a payout that no record accounts for.)
 */
/**
 * Take the refund slot before any money moves.
 *
 * Bumps `refundRecord.version` and records the attempt, both under the same
 * compare-and-set the final write uses. A concurrent request reads the old
 * version, loses this, and is refused having paid out nothing.
 *
 * Returns null when the slot is already taken — either by a request in flight or
 * by one that has moved the version on.
 */
/**
 * Cancel, but only if this request is the one that does it.
 *
 * The service read the order, checked `status !== "cancelled"`, and patched —
 * three separate steps, with a comment claiming the check kept the side effects
 * from running twice. It did not: a double-clicked Cancel, or two operators on
 * the same order, both read `confirmed`, both passed, and both went on to
 * restore the stock and hand the coupon back. A three-cake order ended up six on
 * the shelf and the customer's single-use code was returned twice.
 *
 * The status change IS the guard now. Null means someone else did it, and the
 * caller must do none of the follow-on work.
 */
export async function cancelIfActive(
  id: string,
  fields: Partial<PlacedOrder>,
): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOneAndUpdate(
    { _id: id, status: { $nin: ["cancelled", "refunded"] } },
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

/**
 * Hand a coupon redemption back once, whoever gets there first.
 *
 * Cancelling releases the coupon, and so does a full settled refund — and a
 * cancelled order being refunded is the ordinary path, so both ran and the
 * customer's single-use code came back twice. The refund tracked its own
 * `refundRecord.couponReleased`, which cancellation never saw.
 *
 * Returns true only for the request that actually claimed it.
 */
export async function claimCouponRelease(id: string): Promise<boolean> {
  await connectDB();
  const res = await OrderModel.updateOne(
    { _id: id, couponReleased: { $ne: true } },
    { $set: { couponReleased: true } },
  );
  return (res.modifiedCount ?? 0) > 0;
}

export async function claimRefundAttempt(
  id: string,
  expectedVersion: number,
  attempt: { amount: number; at: string; actorEmail?: string },
): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOneAndUpdate(
    {
      _id: id,
      $expr: { $eq: [{ $ifNull: ["$refundRecord.version", 0] }, expectedVersion] },
      // Nothing may be in flight. A retry arriving while the first attempt is
      // still open must not pay a second time.
      "refundRecord.pendingAttempt": { $exists: false },
    },
    {
      $set: {
        "refundRecord.version": expectedVersion + 1,
        "refundRecord.pendingAttempt": attempt,
        updatedAt: new Date().toISOString(),
      },
    },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

/**
 * Give the refund slot back after an attempt that moved no money.
 *
 * Puts the record back exactly as the claim found it. Nothing can have been
 * written in between — the claim held the slot exclusively — so winding the
 * version back is safe, and it is what lets the retry a 503 invites succeed.
 *
 * An order that had no refund record before keeps having none: leaving a bare
 * `{ version: 1 }` behind would say a refund had been attempted where the
 * screens read the record's existence as exactly that.
 */
export async function releaseRefundAttempt(
  id: string,
  claimedVersion: number,
  hadRecord: boolean,
): Promise<void> {
  await connectDB();
  const filter = {
    _id: id,
    $expr: { $eq: [{ $ifNull: ["$refundRecord.version", 0] }, claimedVersion] },
  };

  await OrderModel.updateOne(
    filter,
    hadRecord
      ? {
          $set: { "refundRecord.version": claimedVersion - 1 },
          $unset: { "refundRecord.pendingAttempt": "" },
        }
      : { $unset: { refundRecord: "" } },
  );
}

/**
 * Write the operator's note and nothing else.
 *
 * Saving a note used to read the order, spread the whole `refundRecord` and
 * write it back through a plain patch — outside the version protocol entirely.
 * A webhook settle landing between that read and that write was erased: the
 * record went back to `processing`, and `stockRestored` and `couponReleased`
 * reverted with it. The next settle then put the stock back and released the
 * coupon a SECOND time.
 *
 * One field, addressed directly. There is nothing here to lose a race with.
 */
export async function setRefundNotes(id: string, notes: string | undefined): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOneAndUpdate(
    { _id: id, refundRecord: { $exists: true } },
    notes
      ? { $set: { "refundRecord.notes": notes, updatedAt: new Date().toISOString() } }
      : { $unset: { "refundRecord.notes": "" }, $set: { updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function compareAndSetRefund(
  id: string,
  expectedVersion: number,
  fields: Partial<PlacedOrder>,
): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOneAndUpdate(
    {
      _id: id,
      $expr: { $eq: [{ $ifNull: ["$refundRecord.version", 0] }, expectedVersion] },
    },
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

/**
 * Orders whose refund the gateway has accepted but not yet reported settling.
 *
 * These are what the `refund.processed` webhook is supposed to finish. When that
 * delivery is missed — no webhook secret configured, a wrong URL, Razorpay
 * exhausting its retries — the record sits at `processing` forever: the money
 * has very likely gone, and the shop's own screens never say so.
 *
 * Bounded, and oldest first, because the ones that have been waiting longest are
 * the ones a webhook is least likely to still rescue.
 */
export async function listUnsettledRefunds(limit = 50): Promise<PlacedOrder[]> {
  await connectDB();
  const docs = (await OrderModel.find({
    "refundRecord.status": "processing",
    "refundRecord.gatewayRefunds.status": "pending",
  })
    .sort({ "refundRecord.requestedAt": 1 })
    .limit(limit)
    .lean()) as unknown as Raw[];
  return docs.map(toOrder);
}

export async function orderNumberExists(orderNumber: string): Promise<boolean> {
  await connectDB();
  return (await OrderModel.exists({ orderNumber })) !== null;
}
