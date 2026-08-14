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

export type SessionState = "active" | "expiring" | "expired";

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

/** The idle timeout is close. Ignored once the session has actually ended. */
export function markSessionExpiring(): void {
  if (state === "expired") return;
  publish("expiring");
}

/** Someone is here again, or has signed back in. */
export function markSessionActive(): void {
  publish("active");
  renewedAt = Date.now();
}

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

/** Wired once by the admin shell; kept here so api modules import no React. */
export function setExpiryConfirmer(confirmer: Confirmer): void {
  confirmExpiry = confirmer;
}

export function noteAuthStatus(status: number): boolean {
  if (status !== 401) return false;
  // Already answered — do not ask again on every 401 of a failed page load.
  if (state !== "expired") confirmExpiry();
  return true;
}
