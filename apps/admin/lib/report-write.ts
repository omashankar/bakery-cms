import { toast } from "sonner";

import { sessionState } from "@/features/auth/lib/session-expiry";

/**
 * Report an admin write honestly, and tell the caller whether it may treat the
 * change as saved.
 *
 * Admin stores dual-write: localStorage first so the UI is instant, then the
 * server. The local half effectively cannot fail, so reporting success on it
 * alone tells the admin that the browser managed to talk to itself. The
 * `use*ServerSync` hooks then overwrite that copy from the server on the next
 * page load, so a rejected write is not saved — it is reverted, quietly, some
 * minutes later, by which time the admin has long since moved on.
 *
 * Pass the same phrase you would have used for success ("Banner created"); the
 * failure message is built from it so the two read as the same event.
 */
export function reportWrite(
  persisted: boolean,
  success: string,
  options?: {
    /**
     * What to say instead when the write was UNDONE locally as well.
     *
     * "on this device only" describes a store that keeps its optimistic write.
     * For one that rolls back — delivery zones do, because a value the server
     * refused would otherwise poison every later save — the change is nowhere at
     * all, and telling the admin it survived locally sends them looking for
     * something that is not there.
     *
     * Given as a phrase rather than derived from `success`: turning "Deleted 3
     * zones" into a failure sentence by pattern is the kind of cleverness that
     * quietly produces nonsense for the next caller.
     */
    failure?: string;
  },
): boolean {
  if (persisted) {
    toast.success(success);
    return true;
  }

  /**
   * A write refused because the SESSION ended is not a write the server
   * rejected, and the difference decides what the admin should do next.
   *
   * "on this device only" tells them the change survived locally and invites a
   * reload to compare — which signs them out of the tab holding it. The api
   * modules mark the session on a 401 before this runs, so by here it is known.
   * The dialog asking them to sign in is already on screen; this only has to
   * stop contradicting it.
   */
  if (sessionState() === "expired") {
    toast.error("Not saved — your session had ended", {
      description: "Sign in again in the dialog, then try once more.",
    });
    return false;
  }

  if (options?.failure) {
    toast.error(options.failure, {
      description: "Nothing was changed. Check the values and try again.",
    });
    return false;
  }

  toast.error(`${success} on this device only — the server rejected it`, {
    description: "Reload to see the server's version, or try again.",
  });
  return false;
}
