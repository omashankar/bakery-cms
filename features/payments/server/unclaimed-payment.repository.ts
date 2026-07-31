import { connectDB } from "@/lib/server/db/mongoose";
import { UnclaimedPaymentModel } from "@/lib/server/db/models/unclaimed-payment.model";

/**
 * The record of money that arrived without an order behind it.
 *
 * See the model for why this exists. Writes are upserts keyed on the gateway's
 * payment id, because the caller is a webhook that Razorpay redelivers.
 */

export interface UnclaimedPayment {
  id: string;
  gateway: string;
  gatewayOrderId: string | null;
  amount: number;
  currency: string;
  reason: string;
  draftId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  resolvedByOrderId: string | null;
  resolvedAt: string | null;
  refundedAt: string | null;
  noticedAt: string;
}

function toRecord(doc: Record<string, unknown>): UnclaimedPayment {
  return {
    id: String(doc._id),
    gateway: (doc.gateway as string) ?? "razorpay",
    gatewayOrderId: (doc.gatewayOrderId as string) ?? null,
    amount: Number(doc.amount) || 0,
    currency: (doc.currency as string) ?? "INR",
    reason: (doc.reason as string) ?? "",
    draftId: (doc.draftId as string) ?? null,
    customerName: (doc.customerName as string) ?? null,
    customerEmail: (doc.customerEmail as string) ?? null,
    customerPhone: (doc.customerPhone as string) ?? null,
    resolvedByOrderId: (doc.resolvedByOrderId as string) ?? null,
    resolvedAt: (doc.resolvedAt as string) ?? null,
    refundedAt: (doc.refundedAt as string) ?? null,
    noticedAt: (doc.noticedAt as string) ?? "",
  };
}

/**
 * Record a captured payment we could not place.
 *
 * `upsert` on the payment id: a redelivered webhook must not create a second
 * row, and `$setOnInsert` on `noticedAt` keeps the first sighting rather than
 * the latest, so an operator can see how long the money has been sitting there.
 * `reason` IS updated — a later delivery may fail differently, and the most
 * recent reason is the actionable one.
 */
export async function recordUnclaimedPayment(input: {
  paymentId: string;
  gatewayOrderId?: string | null;
  amount: number;
  currency?: string;
  reason: string;
  draftId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}): Promise<void> {
  await connectDB();
  await UnclaimedPaymentModel.updateOne(
    { _id: input.paymentId },
    {
      $set: {
        gateway: "razorpay",
        gatewayOrderId: input.gatewayOrderId ?? null,
        amount: input.amount,
        currency: input.currency ?? "INR",
        reason: input.reason,
        draftId: input.draftId ?? null,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
      },
      $setOnInsert: { noticedAt: new Date().toISOString() },
    },
    { upsert: true },
  );
}

/** Close one out once it has become a real order. */
export async function resolveUnclaimedPayment(paymentId: string, orderId: string): Promise<void> {
  await connectDB();
  await UnclaimedPaymentModel.updateOne(
    { _id: paymentId },
    { $set: { resolvedByOrderId: orderId, resolvedAt: new Date().toISOString() } },
  );
}

/** Everything still outstanding, oldest money first — that is what needs chasing. */
export async function listUnclaimedPayments(): Promise<UnclaimedPayment[]> {
  await connectDB();
  const docs = await UnclaimedPaymentModel.find({ resolvedByOrderId: null })
    .sort({ noticedAt: 1 })
    .lean();
  return (docs as unknown as Record<string, unknown>[]).map(toRecord);
}

/** How much money is sitting unplaced, for the operator's alert. */
export async function unclaimedPaymentTotal(): Promise<{ count: number; amount: number }> {
  await connectDB();
  const [summary] = await UnclaimedPaymentModel.aggregate<{ count: number; amount: number }>([
    { $match: { resolvedByOrderId: null } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    { $project: { _id: 0, count: 1, amount: 1 } },
  ]);
  return summary ?? { count: 0, amount: 0 };
}
