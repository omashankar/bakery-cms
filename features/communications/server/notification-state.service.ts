import { connectDB } from "@/lib/server/db/mongoose";
import {
  AdminNotificationStateModel,
  type AdminNotificationStateDoc,
} from "@/lib/server/db/models/admin-notification-state.model";

/**
 * Per-admin read/dismissed notification ids.
 *
 * The API here is a DELTA, never a replace: callers say what to add and what to
 * un-dismiss, and the server unions it in. See the model for why.
 */
export interface NotificationState {
  read: string[];
  dismissed: string[];
}

export interface NotificationStatePatch {
  /** Ids the admin has just read. */
  read?: string[];
  /** Ids the admin has just dismissed. */
  dismissed?: string[];
  /**
   * Ids to stop treating as dismissed.
   *
   * A stock alert describes a state, not an event, so its dismissal must not
   * outlive the condition — the browser prunes `stock:` dismissals whose
   * product is no longer low, and that removal has to reach the server too, or
   * the alert would be silenced forever on every other device the second time
   * the product runs low.
   */
  undismissed?: string[];
}

/**
 * A ceiling on each set, because these grow with every order the shop ever
 * takes. `$addToSet` appends, so keeping the LAST n keeps the most recent — and
 * the feed itself only reaches back 30 days, so an id old enough to fall off
 * this list can no longer be generated anyway.
 */
const MAX_IDS = 2000;

function toState(doc: AdminNotificationStateDoc | null): NotificationState {
  return {
    read: doc?.read ?? [],
    dismissed: doc?.dismissed ?? [],
  };
}

export async function getNotificationState(userId: string): Promise<NotificationState> {
  await connectDB();
  return toState(await AdminNotificationStateModel.findById(userId).lean());
}

export async function patchNotificationState(
  userId: string,
  patch: NotificationStatePatch,
): Promise<NotificationState> {
  await connectDB();

  const read = patch.read ?? [];
  const dismissed = patch.dismissed ?? [];
  // An id being both dismissed and un-dismissed in one request is the caller
  // contradicting itself; the dismissal is the newer intent, so it wins.
  const undismissed = (patch.undismissed ?? []).filter((id) => !dismissed.includes(id));

  // Two writes, not one: Mongo refuses `$pullAll` and `$addToSet` on the same
  // path in a single update, and the removal has to land first so that
  // re-dismissing something in the same breath is not immediately undone.
  if (undismissed.length > 0) {
    await AdminNotificationStateModel.updateOne(
      { _id: userId },
      { $pullAll: { dismissed: undismissed } },
      { upsert: true },
    );
  }

  const additions: Record<string, unknown> = {};
  if (read.length > 0) additions.read = { $each: read };
  if (dismissed.length > 0) additions.dismissed = { $each: dismissed };

  const updated =
    Object.keys(additions).length > 0
      ? await AdminNotificationStateModel.findOneAndUpdate(
          { _id: userId },
          { $addToSet: additions },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean()
      : await AdminNotificationStateModel.findById(userId).lean();

  const state = toState(updated);
  const overflow: Record<string, unknown> = {};
  if (state.read.length > MAX_IDS) overflow.read = { $each: [], $slice: -MAX_IDS };
  if (state.dismissed.length > MAX_IDS) overflow.dismissed = { $each: [], $slice: -MAX_IDS };

  if (Object.keys(overflow).length > 0) {
    return toState(
      await AdminNotificationStateModel.findOneAndUpdate(
        { _id: userId },
        { $push: overflow },
        { new: true },
      ).lean(),
    );
  }

  return state;
}
