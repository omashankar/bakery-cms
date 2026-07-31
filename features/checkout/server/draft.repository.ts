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
 */
export async function consumeDraft(id: string, orderId: string): Promise<boolean> {
  await connectDB();
  const result = await CheckoutDraftModel.updateOne(
    { _id: id, consumedByOrderId: null },
    { $set: { consumedByOrderId: orderId } },
  );
  return result.modifiedCount === 1;
}
