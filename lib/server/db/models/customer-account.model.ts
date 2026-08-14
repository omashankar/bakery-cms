import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * A customer who can sign in and see their own orders.
 *
 * Keyed on EMAIL, lowercased, because that is what an order is already keyed
 * on: `address.email` is what `findByCustomerEmail` queries, what the admin's
 * customer list groups by, and what `customermetas` stores its rows under. An
 * account keyed on anything else would be an account that cannot find its own
 * orders — which is the bug this model exists to end. The storefront's previous
 * phone-first sign-in minted `<phone>@customer.local` identities for exactly
 * that reason and matched nothing.
 *
 * There is no password. Signing in means proving control of the email, which is
 * the same thing the order confirmation was sent to, so the proof and the claim
 * are about the same address. See `customer-login-code.model.ts`.
 */
const customerAccountSchema = new mongoose.Schema(
  {
    /** Lowercased and trimmed by the service before it ever reaches here. */
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    /** When they last proved control of this address. */
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    /**
     * Set by an admin to stop this address signing in. Distinct from the
     * `blocked` flag on `customermetas`, which is about orders, not access.
     */
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

applyBaseTransform(customerAccountSchema);

export type CustomerAccountDoc = InferSchemaType<typeof customerAccountSchema>;

export const CustomerAccountModel: Model<CustomerAccountDoc> =
  (mongoose.models.CustomerAccount as Model<CustomerAccountDoc>) ||
  mongoose.model<CustomerAccountDoc>("CustomerAccount", customerAccountSchema);
