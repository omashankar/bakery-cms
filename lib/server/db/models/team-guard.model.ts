import mongoose, { type Model } from "mongoose";

import { defineModel } from "./_define-model";

/**
 * A single document every owner-reducing change writes to, inside its
 * transaction.
 *
 * "At least one active owner" is a rule about the WHOLE set of users, and two
 * transactions that each read "2 owners", each demote a DIFFERENT owner and each
 * commit would leave none — snapshot isolation does not stop that, because they
 * never write the same row. Making both bump this document turns the second one
 * into a write conflict; the driver retries it, it re-reads "1 owner", and it
 * is refused.
 */
const teamGuardSchema = new mongoose.Schema({
  _id: { type: String },
  version: { type: Number, default: 0 },
});

export type TeamGuardDoc = { _id: string; version: number };

export const TeamGuardModel: Model<TeamGuardDoc> =
  defineModel<TeamGuardDoc>("TeamGuard", teamGuardSchema);
