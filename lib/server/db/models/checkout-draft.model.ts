import mongoose from "mongoose";

/**
 * A priced cart, held by the SERVER between quoting and payment.
 *
 * This is the record the money path was missing. The amount Razorpay was asked
 * to charge came from the request body, and the prices stored on the order came
 * from the request body — so by the time anything server-side looked at an
 * order, the customer had already been charged whatever they chose. Validating
 * at placement is validating after the money moved.
 *
 * A draft is created when the cart is quoted, carries the total the SHOP
 * computed, and is what the gateway order is opened against. The payment is then
 * checked against the draft rather than against anything the browser says.
 *
 * Short-lived on purpose: prices, delivery fees and coupons all change, and a
 * draft is a promise about them. `expiresAt` has a TTL index, so Mongo removes
 * abandoned carts without a sweeper.
 */
const checkoutDraftSchema = new mongoose.Schema(
  {
    // Server-minted. The client never chooses this, which is what makes it
    // usable as the identity for the whole payment round trip.
    _id: { type: String },

    /** The lines as the SHOP priced them, ready to become order items. */
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /** The totals the SHOP computed. The only numbers anything may charge. */
    totals: { type: mongoose.Schema.Types.Mixed, required: true },
    coupon: { type: mongoose.Schema.Types.Mixed, default: null },
    giftWrap: { type: Boolean, default: false },
    deliveryAddress: { type: mongoose.Schema.Types.Mixed, default: null },

    // The rest of the order intent, so a webhook can finish a payment whose
    // customer closed the tab before the confirmation came back.
    address: { type: mongoose.Schema.Types.Mixed, default: null },
    deliverySlot: { type: mongoose.Schema.Types.Mixed, default: null },
    orderNotes: { type: String, default: null },

    /** Set once a gateway order is opened for this draft. */
    razorpayOrderId: { type: String, default: null, index: true },
    /** Set once the draft becomes a real order, so it cannot be spent twice. */
    consumedByOrderId: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false, _id: false },
);

export type CheckoutDraftDoc = mongoose.InferSchemaType<typeof checkoutDraftSchema> & {
  _id: string;
};

export const CheckoutDraftModel =
  (mongoose.models.CheckoutDraft as mongoose.Model<CheckoutDraftDoc>) ||
  mongoose.model<CheckoutDraftDoc>("CheckoutDraft", checkoutDraftSchema);
