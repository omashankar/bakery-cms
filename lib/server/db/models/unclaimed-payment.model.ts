import mongoose from "mongoose";

/**
 * Money the shop received that never became an order.
 *
 * Transactions in this system are DERIVED from orders — one row per order, built
 * by `buildTransactions`. That projection is only truthful while every payment
 * has an order behind it, and the checkout has several ways for that to fail
 * after the customer has been charged: the priced cart expired before the
 * gateway's webhook arrived (drafts live 30 minutes, a retried webhook can land
 * later), the cart was quoted before the customer entered an address, or the
 * payment settled a gateway order this shop has no record of opening.
 *
 * Every one of those used to end in `return Response.json({ ok: true })` and a
 * `console.error`. The customer's money sat in the Razorpay account, and the one
 * screen an operator would go to in order to find it — the Transaction Centre —
 * was the screen that could not show it, because there was no order to derive a
 * row from. Missing money looked exactly like money that was never sent.
 *
 * So: an explicit record, keyed on the gateway's own payment id. It is the
 * ledger's entry for "this arrived and we could not place it", and it is
 * deliberately a separate collection from orders — writing a fake order would
 * put a fictional sale into revenue, stock and the customer's history.
 */
const unclaimedPaymentSchema = new mongoose.Schema(
  {
    /**
     * The gateway's payment id (`pay_…`).
     *
     * Used as the primary key so a retried webhook — Razorpay redelivers for
     * hours — records the same payment once instead of once per delivery.
     */
    _id: { type: String },

    gateway: { type: String, default: "razorpay" },
    gatewayOrderId: { type: String, default: null, index: true },
    /** Major units, as the gateway reported it. */
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    /** Which early-return this was, in words an operator can act on. */
    reason: { type: String, required: true },
    /** The draft it belonged to, when there was one. */
    draftId: { type: String, default: null },
    /** Whatever contact detail we have, so someone can ring the customer. */
    customerName: { type: String, default: null },
    customerEmail: { type: String, default: null },
    customerPhone: { type: String, default: null },

    /** Set once an operator (or a later webhook) turns this into a real order. */
    resolvedByOrderId: { type: String, default: null },
    resolvedAt: { type: String, default: null },
    /** Set when an operator refunds it instead of fulfilling it. */
    refundedAt: { type: String, default: null },

    noticedAt: { type: String, required: true },
  },
  { versionKey: false, _id: false },
);

// The operator's question is always "what is outstanding?", newest first.
unclaimedPaymentSchema.index({ resolvedByOrderId: 1, noticedAt: -1 });

export type UnclaimedPaymentDoc = mongoose.InferSchemaType<typeof unclaimedPaymentSchema> & {
  _id: string;
};

export const UnclaimedPaymentModel =
  (mongoose.models.UnclaimedPayment as mongoose.Model<UnclaimedPaymentDoc>) ||
  mongoose.model<UnclaimedPaymentDoc>("UnclaimedPayment", unclaimedPaymentSchema);
