import { randomUUID } from "node:crypto";

import { connectDB } from "@/lib/server/db/mongoose";
import { CheckoutDraftModel } from "@/lib/server/db/models/checkout-draft.model";

import type { CartQuote } from "./pricing.server";

/**
 * Drafts — the server's copy of a priced cart, between quoting and payment.
 *
 * See the model for why this exists at all. The short version: nothing in this
 * system used to hold a total that the customer had not chosen, so there was
 * nothing for a payment to be checked against.
 */

/** Long enough to finish a checkout, short enough that prices cannot drift. */
const DRAFT_TTL_MINUTES = 30;

export interface CheckoutDraft {
  id: string;
  items: CartQuote["items"];
  totals: CartQuote["totals"];
  coupon: CartQuote["coupon"];
  giftWrap: boolean;
  deliveryAddress: { city?: string; pincode?: string } | null;
  /** The rest of the order intent, present once the customer has an address. */
  address: Record<string, string> | null;
  deliverySlot: { date?: string; timeSlot?: string } | null;
  orderNotes: string | null;
  razorpayOrderId: string | null;
  consumedByOrderId: string | null;
}

function toDraft(doc: Record<string, unknown>): CheckoutDraft {
  return {
    id: String(doc._id),
    items: doc.items as CheckoutDraft["items"],
    totals: doc.totals as CheckoutDraft["totals"],
    coupon: (doc.coupon ?? null) as CheckoutDraft["coupon"],
    giftWrap: Boolean(doc.giftWrap),
    deliveryAddress: (doc.deliveryAddress ?? null) as CheckoutDraft["deliveryAddress"],
    address: (doc.address ?? null) as CheckoutDraft["address"],
    deliverySlot: (doc.deliverySlot ?? null) as CheckoutDraft["deliverySlot"],
    orderNotes: (doc.orderNotes ?? null) as string | null,
    razorpayOrderId: (doc.razorpayOrderId ?? null) as string | null,
    consumedByOrderId: (doc.consumedByOrderId ?? null) as string | null,
  };
}

export async function createDraft(
  quote: CartQuote,
  context: {
    giftWrap: boolean;
    deliveryAddress?: { city?: string; pincode?: string };
    address?: Record<string, string>;
    deliverySlot?: { date?: string; timeSlot?: string };
    orderNotes?: string;
  },
): Promise<CheckoutDraft> {
  await connectDB();
  const doc = await CheckoutDraftModel.create({
    _id: `draft_${randomUUID()}`,
    items: quote.items,
    totals: quote.totals,
    coupon: quote.coupon,
    giftWrap: context.giftWrap,
    deliveryAddress: context.deliveryAddress ?? null,
    address: context.address ?? null,
    deliverySlot: context.deliverySlot ?? null,
    orderNotes: context.orderNotes ?? null,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MINUTES * 60_000),
  });
  return toDraft(doc.toObject());
}

export async function findDraft(id: string): Promise<CheckoutDraft | null> {
  await connectDB();
  const doc = await CheckoutDraftModel.findById(id).lean();
  return doc ? toDraft(doc as Record<string, unknown>) : null;
}

/**
 * The draft a gateway order was opened for.
 *
 * This is the lookup the webhook needs, and the reason the gateway order id is
 * stored at all — before this, nothing on our side knew which cart a Razorpay
 * payment belonged to.
 */
export async function findDraftByRazorpayOrder(
  razorpayOrderId: string,
): Promise<CheckoutDraft | null> {
  await connectDB();
  const doc = await CheckoutDraftModel.findOne({ razorpayOrderId }).lean();
  return doc ? toDraft(doc as Record<string, unknown>) : null;
}

/** Records which gateway order was opened for this draft. */
export async function attachRazorpayOrder(id: string, razorpayOrderId: string): Promise<void> {
  await connectDB();
  await CheckoutDraftModel.updateOne({ _id: id }, { $set: { razorpayOrderId } });
}

/**
 * Marks a draft spent, and reports whether THIS call is the one that spent it.
 *
 * Conditional on `consumedByOrderId` still being null, so two concurrent
 * placements of the same draft cannot both become orders — the second gets
 * `false` and is sent to the idempotent path instead.
 *
 * This must be called BEFORE the order is inserted, not after. Called after,
 * both of two concurrent placements have already inserted their order by the
 * time either one loses the race, and the loser's return value cannot undo
 * anything — one captured payment becomes two paid orders and two stock
 * decrements. Claiming first makes this the single point where the two requests
 * are ordered.
 */
export async function consumeDraft(id: string, orderId: string): Promise<boolean> {
  await connectDB();
  const result = await CheckoutDraftModel.updateOne(
    { _id: id, consumedByOrderId: null },
    { $set: { consumedByOrderId: orderId, consumedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

/**
 * How long a claim is left alone before another request may take it.
 *
 * Must comfortably exceed the longest a claimer could still be working. The
 * order insert runs inside `session.withTransaction`, whose writes are invisible
 * to outside readers until it commits, and whose driver-side retry of transient
 * errors runs for up to 120 seconds. Anything shorter and a healthy, slow
 * transaction gets its claim stolen — which produces the exact double order this
 * whole protocol exists to prevent.
 */
const CLAIM_GRACE_MS = 3 * 60_000;

/**
 * Hand the claim back, so a placement that failed after claiming can be retried.
 *
 * Conditional on us still being the owner: if a takeover has happened in between
 * we must not clear someone else's claim.
 */
export async function releaseDraft(id: string, orderId: string): Promise<void> {
  await connectDB();
  await CheckoutDraftModel.updateOne(
    { _id: id, consumedByOrderId: orderId },
    { $set: { consumedByOrderId: null, consumedAt: null } },
  );
}

/**
 * Take over a claim whose order never materialised.
 *
 * A request that claims the draft and then dies before inserting leaves it
 * pointing at an order id that does not exist. Without a way back that is a
 * captured payment nobody can ever place — strictly worse than the duplicate
 * this claim-first ordering exists to prevent.
 *
 * But "the order is not readable" does NOT mean the claimer is dead. The insert
 * runs inside a transaction, and until it commits the row is invisible to
 * everyone else — so a perfectly healthy claimer looks identical to a dead one.
 * Only a claim that has been sitting unfinished for longer than any transaction
 * could plausibly run is taken, which is what keeps this from re-creating the
 * duplicate order it exists to repair. Conditional on the stale owner too, so
 * only one of several retries wins.
 */
export async function reclaimDraft(
  id: string,
  staleOrderId: string,
  newOrderId: string,
): Promise<boolean> {
  await connectDB();
  const result = await CheckoutDraftModel.updateOne(
    {
      _id: id,
      consumedByOrderId: staleOrderId,
      consumedAt: { $lt: new Date(Date.now() - CLAIM_GRACE_MS) },
    },
    { $set: { consumedByOrderId: newOrderId, consumedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}
