import mongoose from "mongoose";

/**
 * Payment gateway secrets, server-side.
 *
 * Two things were wrong with where these lived before.
 *
 * Razorpay's keys were written to `.razorpay-config.json` on the local disk of
 * whichever instance served the POST. A second instance, a container restart, or
 * any serverless deployment simply does not have that file — the shop appears
 * unconfigured and every payment fails, with nothing pointing at why.
 *
 * Every OTHER gateway's secrets — Stripe's `sk_live_`, PayPal's client secret,
 * PhonePe's salt key, PayU's merchant salt, CCAvenue's working key, Square's
 * access token, Authorize.Net's transaction key — were written to the admin's
 * BROWSER, in localStorage, in plaintext. They survived logout, were re-pushed
 * to every device that admin signed in from, and were readable by any script on
 * the page. A live Stripe secret key can charge, refund and pay out.
 *
 * So: one server-side collection, keyed by gateway id, that no client-facing
 * response ever includes. The browser gets a status — which fields are set —
 * and never the values.
 */
const gatewayCredentialSchema = new mongoose.Schema(
  {
    /** The gateway id from the registry: "razorpay", "stripe", … */
    _id: { type: String },
    /**
     * The secret material, shaped by that gateway's own config fields.
     *
     * Mixed because each gateway names its fields differently and the registry
     * is the schema. Never projected into an API response.
     */
    credentials: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: String },
  },
  { versionKey: false, _id: false },
);

export type GatewayCredentialDoc = mongoose.InferSchemaType<typeof gatewayCredentialSchema> & {
  _id: string;
};

export const GatewayCredentialModel =
  (mongoose.models.GatewayCredential as mongoose.Model<GatewayCredentialDoc>) ||
  mongoose.model<GatewayCredentialDoc>("GatewayCredential", gatewayCredentialSchema);
