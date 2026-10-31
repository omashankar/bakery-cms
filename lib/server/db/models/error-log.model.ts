import mongoose, { type Model } from "mongoose";

import { defineModel } from "./_define-model";

/**
 * One kind of failure the shop has had — not one row per occurrence.
 *
 * Grouped by `fingerprint` (where + what), so a crash a hundred customers hit
 * is one entry with a count of a hundred rather than a hundred rows burying
 * the one that happened once. Kept for 30 days after it was LAST seen: a
 * failure that has stopped happening ages out, one that keeps happening stays.
 *
 * Nothing secret is stored: paths lose their query string, messages are
 * trimmed and scrubbed of tokens before they get here (record-error.ts).
 */
const errorLogSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, required: true, unique: true, index: true },
    /** "server" — a page or API on the server; "browser" — a page crashed in a visitor's browser. */
    source: { type: String, enum: ["server", "browser"], required: true },
    /** "page", "api", "action", "proxy" or "browser". */
    kind: { type: String, default: "" },
    message: { type: String, default: "" },
    stack: { type: String, default: "" },
    path: { type: String, default: "" },
    method: { type: String, default: "" },
    route: { type: String, default: "" },
    digest: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    count: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: { type: Date, default: () => new Date(), index: { expires: 60 * 60 * 24 * 30 } },
    /** The owner marked it dealt with; a new occurrence opens it again. */
    resolvedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export interface ErrorLogDoc {
  _id: mongoose.Types.ObjectId;
  fingerprint: string;
  source: "server" | "browser";
  kind: string;
  message: string;
  stack: string;
  path: string;
  method: string;
  route: string;
  digest: string;
  userAgent: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

export const ErrorLogModel: Model<ErrorLogDoc> = defineModel<ErrorLogDoc>("ErrorLog", errorLogSchema);
