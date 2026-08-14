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
}

/**
 * Record what a response says about the session, and answer whether the caller
 * was refused for that reason.
 *
 * 401 is the only status that means it: a 403 is a permission the account does
 * not have — a real answer from a live session — and a 5xx is the server
 * failing, which a re-login would not fix. Telling those apart is the whole
 * point, because the screens react to each differently.
 */
export function noteAuthStatus(status: number): boolean {
  if (status !== 401) return false;
  markSessionExpired();
  return true;
}
