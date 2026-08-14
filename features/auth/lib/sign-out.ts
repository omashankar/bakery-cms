"use client";

import { clearDemoSession } from "./session";
import { logoutRequest } from "./auth-api";

/**
 * Sign out of THIS device, and say whether it actually happened.
 *
 * Signing out is an access control, and the only thing that performs it is
 * `clearAuthCookies()` at the end of the server's `logout`. `clearDemoSession()`
 * removes a localStorage marker that gates nothing — there is no proxy check on
 * `/admin` and `AdminLayoutShell` performs no session check, so the admin area
 * and every `/api/*` endpoint stay fully reachable on the surviving cookies. The
 * refresh cookie lasts thirty days.
 *
 * All three sign-out paths did `await logoutRequest().catch(() => undefined)`
 * and then redirected to the login page unconditionally, with a comment saying
 * the redirect happens "regardless so the user is never stuck". Landing on the
 * login form IS the report: on a shared or public machine the admin walks away
 * believing they are signed out, and the next person to type /admin/orders is
 * signed in as them. The "log out everywhere" flow was no better — it surfaced
 * an error, but attributed the failure to the OTHER devices while asserting
 * "This browser is signed out either way", which is the part that was untrue.
 *
 * The local marker is cleared only when the server confirms, so a failed sign-out
 * leaves the browser in one honest state rather than half of each.
 */
export async function signOutOfThisDevice(): Promise<boolean> {
  const signedOut = await logoutRequest()
    .then(() => true)
    .catch(() => false);

  if (signedOut) {
    clearDemoSession();
    clearAdminDeviceData();
  }
  return signedOut;
}

/**
 * What the previous admin leaves behind on a shared machine.
 *
 * Sign-out cleared the session marker and nothing else, so the next person to
 * open the browser — before signing in as anyone — could read the previous
 * admin's name, email and photo out of the profile cache, their login history
 * and active devices out of the security centre, and the shop's SMTP host and
 * username, analytics ids and maintenance state out of the settings cache.
 *
 * These are all mirrors of server state, re-fetched on the next sign-in, so
 * clearing them costs a hydration and nothing else.
 */
function clearAdminDeviceData(): void {
  if (typeof window === "undefined") return;

  for (const key of ADMIN_DEVICE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

const ADMIN_DEVICE_KEYS = [
  "bakery-cms-admin-profile",
  "bakery-cms-admin-account",
  "bakery-cms-security-center",
  "bakery-cms-settings",
] as const;

/** What to tell someone whose sign-out the server never completed. */
export const SIGN_OUT_FAILED = {
  title: "Could not sign you out",
  description:
    "You are still signed in on this device. Check your connection and try again.",
} as const;
