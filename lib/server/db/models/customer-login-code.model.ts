import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * A one-time code emailed to a customer so they can sign in.
 *
 * Stored HASHED, for the same reason a password is: this collection is one
 * database read away from letting anyone sign in as any customer who happens to
 * have a code outstanding.
 *
 * `attempts` is on the row rather than in memory because guessing is the whole
 * risk with a 6-digit code — a per-process counter would reset on deploy and
 * would not be shared between instances. Five wrong guesses burns the code.
 *
 * The TTL index is what makes a code expire even if nobody ever comes back for
 * it, and it is also the cleanup: Mongo removes the row itself.
 */
const customerLoginCodeSchema = new mongoose.Schema({
  /** Lowercased email the code was sent to. */
  email: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: () => new Date() },
  /** Where the request came from, so abuse can be traced in the audit log. */
  ip: { type: String, default: "" },
});

// Mongo purges the row once expiresAt passes; nothing else has to.
customerLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

applyBaseTransform(customerLoginCodeSchema);

export type CustomerLoginCodeDoc = InferSchemaType<typeof customerLoginCodeSchema>;

export const CustomerLoginCodeModel: Model<CustomerLoginCodeDoc> =
  (mongoose.models.CustomerLoginCode as Model<CustomerLoginCodeDoc>) ||
  mongoose.model<CustomerLoginCodeDoc>("CustomerLoginCode", customerLoginCodeSchema);
