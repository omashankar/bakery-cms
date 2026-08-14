"use client";

/**
 * Whether this browser's admin session has ended, and whether it is about to.
 *
 * Nothing tracked this. The server ends a session — idle past the shop's
 * timeout, revoked, or the account disabled — and answers 401; `refreshSession`
 * returned a boolean that `useSessionRefresh` discarded with `void`. Meanwhile
 * every `*-api.ts` maps a non-ok response to `null`/`false`, deliberately, so
 * the caller can tell "no data" from "bad data". The result was an admin panel
 * that stayed on screen and quietly emptied: lists went to their loading or
 * empty states, saves reported "saved on this device only — the server rejected
 * it", and nothing said the person was signed out.
 *
 * A module-level store rather than context: the 401 can surface from any api
 * module, none of which sit under a provider, and there is exactly one session
 * per browser.
 */

/**
 * `checking` exists because the answer takes a round trip.
 *
 * A 401 used to publish "expired" synchronously, and the write reporters were
 * built on that: they read `sessionState()` the instant a refused write
 * returned. Making the 401 into a QUESTION — the right fix, since a routine
 * expired access token is not a dead session — quietly broke them. The question
 * is asked, `noteAuthStatus` returns, the reporter reads "active", and the
 * admin is told "saved on this device only — the server rejected it" a
 * heartbeat before the sign-in dialog lands on top of it, contradicting it and
 * advising a reload that would destroy the unsaved edits the dialog promises
 * are safe.
 *
 * So the question itself is a state. It is published SYNCHRONOUSLY, which is
 * what the reporters need, and it says exactly what is true at that moment:
 * we have asked and do not yet know.
 */
export type SessionState = "active" | "checking" | "expiring" | "expired";

let state: SessionState = "active";
const listeners = new Set<(next: SessionState) => void>();

function publish(next: SessionState): void {
  if (state === next) return;
  state = next;
  for (const listener of [...listeners]) listener(next);
}

export function sessionState(): SessionState {
  return state;
}

export function subscribeToSession(listener: (next: SessionState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The session is over. Irreversible until a successful re-authentication.
 *
 * `expiring` is only a prediction, so it must never overwrite this.
 */
export function markSessionExpired(): void {
  publish("expired");
}

/**
 * The idle timeout is close.
 *
 * A prediction, so it yields to anything better informed: a session already
 * known to have ended, and a question already put to the server.
 */
export function markSessionExpiring(): void {
  if (state === "expired" || state === "checking") return;
  publish("expiring");
}

/*
 * There is deliberately no `markSessionActive`.
 *
 * It existed and had no callers left, which made it worse than unused: it
 * published "active" AND reset the idle clock, so the next person to reach for
 * the obvious-sounding name would silently have told the warning that the
 * server had just renewed a session it had not. Going back to "active" is not
 * a thing anything is entitled to assert on its own — only a renewal the
 * server confirmed is, and that is `markSessionRenewed` below.
 */

/**
 * When the SERVER's idle clock was last moved, as far as this browser knows.
 *
 * The server times a session out against `lastSeenAt`, which only advances on a
 * successful refresh. The warning used to predict against the client's last
 * KEYSTROKE instead, and those are not the same instant — the heartbeat renews
 * up to PRESENCE_WINDOW_MS after the last input, so the prediction fired minutes
 * early on a session that was nowhere near ending. Then the countdown "asked"
 * the server, which renewed it, and the whole cycle began again: an unattended
 * tab warned, renewed, warned, renewed, roughly every seventy seconds, forever.
 */
let renewedAt = Date.now();

/** Called when a refresh SUCCEEDS — the one moment the server's clock moves. */
export function markSessionRenewed(): void {
  renewedAt = Date.now();
  publish("active");
}

/** How long the server has considered this session idle. */
export function idleForMs(): number {
  return Date.now() - renewedAt;
}

/**
 * Record what a response says about the session, and answer whether the caller
 * was refused for that reason.
 *
 * A 401 is NOT proof the session is over, and treating it as proof was wrong in
 * the routine case: the access token is short-lived and expires on its own every
 * few minutes, which is the exact condition the refresh flow exists to repair.
 * Publishing "expired" for it put a password prompt over a perfectly live
 * session — and, because the heartbeat stops once expired, killed the very
 * renewal that would have fixed it.
 *
 * So a 401 raises a QUESTION, and the caller supplied by `setExpiryConfirmer`
 * puts it to the server. Only the server's answer ends a session.
 *
 * 403 and 5xx are not even questions: a 403 is a permission this account does
 * not have — a real answer from a live session — and a 5xx is the server
 * failing, which signing in again cannot fix.
 */
type Confirmer = () => void;
let confirmExpiry: Confirmer = () => {};

/** Test helper: forget the registered confirmer and reset the idle clock. */
export function resetSessionTracking(): void {
  confirmExpiry = () => {};
  state = "active";
  renewedAt = Date.now();
}

const NO_CONFIRMER: Confirmer = () => {};

/**
 * Wired by the admin shell; kept here so api modules import no React.
 *
 * Returns its own undo, and the shell MUST call it on unmount. Without that
 * the callback outlives the layout that registered it: an admin who navigates
 * to the storefront leaves a live confirmer behind, and a 401 from any module
 * both surfaces share then renews the admin session from a page that has no
 * admin on it — the unattended renewal this feature exists to prevent, through
 * a second door.
 */
export function setExpiryConfirmer(confirmer: Confirmer): () => void {
  confirmExpiry = confirmer;
  return () => {
    // Only if it is still ours. A remount registers before the old effect's
    // cleanup runs, and clearing unconditionally would unregister the LIVE one.
    if (confirmExpiry === confirmer) confirmExpiry = NO_CONFIRMER;
  };
}

export function noteAuthStatus(status: number): boolean {
  if (status !== 401) return false;
  // Already answered, or already asking — a failed page load fires a 401 from
  // every panel on it, and one question is enough.
  if (state === "expired" || state === "checking") return true;

  // Published BEFORE the question goes out, because the caller reports its
  // refused write on the very next line and has to have something true to say.
  publish("checking");
  confirmExpiry();
  return true;
}
