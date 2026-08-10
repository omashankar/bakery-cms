import mongoose, { type InferSchemaType, type Model } from "mongoose";

/**
 * Which alerts an admin has read, and which they have dismissed — per admin.
 *
 * This lived in two localStorage keys, so it was per BROWSER: an owner who
 * cleared the bell on the shop laptop opened the admin on their phone to the
 * same thirty unread alerts, dismissed one on each device separately, and lost
 * the lot on a cache clear. Two people sharing the shop laptop shared each
 * other's read state, while the same person on two devices did not.
 *
 * Keyed by user id (the document `_id`), because read state is personal: one
 * admin working through the refund queue must not silence the bell for another.
 * Dismissal is deliberately personal too — it hides a row from a feed, it does
 * not resolve anything, and the alert is re-derived for anyone who has not
 * dismissed it.
 *
 * Both fields are grow-only sets of notification ids, written with `$addToSet`
 * deltas rather than a whole-array replace. That is the point: a tab open since
 * yesterday can only ever ADD to what it knows, so it cannot erase read state
 * recorded on another device in between — the failure that every replace-all
 * store in this codebase had to be repaired for.
 */
const adminNotificationStateSchema = new mongoose.Schema(
  {
    _id: { type: String },
    read: { type: [String], default: [] },
    dismissed: { type: [String], default: [] },
  },
  { versionKey: false, timestamps: true, minimize: false },
);

export type AdminNotificationStateDoc = InferSchemaType<typeof adminNotificationStateSchema>;

export const AdminNotificationStateModel: Model<AdminNotificationStateDoc> =
  (mongoose.models.AdminNotificationState as Model<AdminNotificationStateDoc>) ||
  mongoose.model<AdminNotificationStateDoc>(
    "AdminNotificationState",
    adminNotificationStateSchema,
  );
