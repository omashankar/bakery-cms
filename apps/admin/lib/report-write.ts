import { toast } from "sonner";

import { sessionState } from "@/features/auth/lib/session-expiry";

/**
 * A write refused because of WHO was asking, not what was sent.
 *
 * "on this device only" tells the admin the change survived locally and invites
 * a reload to compare — which signs them out of the very tab holding it. The
 * server did not reject the value; it did not know who was asking.
 *
 * `checking` is the important half. A 401 does not publish "expired" any more —
 * it asks the server, because a routine expired access token is not a dead
 * session — and that answer takes a round trip this reporter does not wait for.
 * Reading only for "expired" here meant the guard was dead on the ordinary
 * path: the misleading toast went out, and the sign-in dialog landed on top of
 * it a moment later, contradicting it.
 *
 * EXPORTED, because most admin writes do not go through the reporters below.
 * Fifteen screens build their own `toast.error` with wording tuned to what they
 * just did — a stock adjustment, a refund, a template — and every one of them
 * said "the server rejected it" for a write the server had merely not
 * recognised. Copying this check into each of them is how the last four rounds
 * of this bug happened, so there is one of it and every caller reaches for the
 * same one.
 *
 * Returns true when it has already said what happened; the caller must then say
 * nothing more.
 */
export interface WhatDidLand {
  /**
   * Replaces "Not saved" when the caller knows something more precise.
   *
   * "Not saved" is right for a single write and FALSE for one that got part of
   * the way: a backup restore pushes its sections one at a time, so a session
   * that ends half-way through leaves some of them on the server and the
   * browser's own stores already replaced. Telling that admin "not saved"
   * discards the only report of what actually landed — and it is the moment
   * they are least able to check by eye.
   */
  title?: string;
  /** What DID happen, said before the remedy. */
  detail?: string;
}

interface Wording {
  /** Used when the caller has nothing more precise to say. */
  fallback: string;
  /** The same fact, as a sentence, for when the caller supplies the headline. */
  cause: string;
  remedy: string;
}

const ENDED: Wording = {
  fallback: "Not saved — your session had ended",
  cause: "Your session had ended.",
  remedy: "Sign in again in the dialog, then try once more.",
};

// Deliberately not a verdict. We asked and have not heard back, and saying
// either "the server rejected it" or "you are signed out" would be a claim this
// moment cannot support.
const ASKING: Wording = {
  fallback: "Not saved — checking whether you are still signed in",
  cause: "We are checking whether you are still signed in.",
  remedy: "Wait a moment, then try again.",
};

/**
 * One message, built from what the caller knows and what the session says.
 *
 * With a caller's own headline the sentence about the session has to move into
 * the description — dropping it leaves a message that explains nothing.
 */
function announce(said: Wording, landed?: WhatDidLand): void {
  toast.error(landed?.title ?? said.fallback, {
    description: landed
      ? [landed.detail, said.cause, said.remedy].filter(Boolean).join(" ")
      : said.remedy,
  });
}

export function reportedAsSignedOut(landed?: WhatDidLand): boolean {
  const state = sessionState();

  if (state === "expired") {
    announce(ENDED, landed);
    return true;
  }

  if (state === "checking") {
    announce(ASKING, landed);
    return true;
  }

  return false;
}

/**
 * The same question, for a READ.
 *
 * `reportedAsSignedOut` says "Not saved — …", which is the right sentence for
 * a refused write and the wrong one for a failed load: it was wired into
 * "Could not load that order" and two exports, so the only thing an admin was
 * told about a failed READ is that something had not been saved. Same
 * question, different sentence.
 */
export function reportedAsSignedOutOnRead(): boolean {
  const state = sessionState();

  if (state === "expired") {
    toast.error("Could not load it — your session had ended", {
      description: "Sign in again in the dialog, then try once more.",
    });
    return true;
  }

  if (state === "checking") {
    toast.error("Could not load it — checking whether you are still signed in", {
      description: "Wait a moment, then try again.",
    });
    return true;
  }

  return false;
}

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

  if (reportedAsSignedOut()) return false;

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
