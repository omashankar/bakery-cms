import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";
import { defineModel } from "./_define-model";

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
    /**
     * Their profile photo on Cloudinary, and the asset id that deletes it when
     * they change or remove it. Kept out of `photouploads`: that collection's
     * sweep deletes any photo no order claims, and nothing orders an avatar.
     */
    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },
    /** When they last proved control of this address. */
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    /**
     * Set by an admin to stop this address signing in. Distinct from the
     * `blocked` flag on `customermetas`, which is about orders, not access.
     */
    blocked: { type: Boolean, default: false },
    /**
     * The customer's address book — the shape `SavedAddress` describes,
     * validated at the endpoint (`savedAddressesSchema`). It lived in one
     * browser's localStorage, so an address saved on a phone was not there on
     * the laptop, and clearing site data lost the lot.
     */
    addresses: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /**
     * When the book was last written. Null means it never has been — the one
     * case where a device's own pre-account copy may be uploaded. An emptied
     * book has a date, so an old device cannot bring deleted addresses back.
     */
    addressesSavedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

applyBaseTransform(customerAccountSchema);

export type CustomerAccountDoc = InferSchemaType<typeof customerAccountSchema>;

export const CustomerAccountModel: Model<CustomerAccountDoc> =
  defineModel<CustomerAccountDoc>("CustomerAccount", customerAccountSchema);
