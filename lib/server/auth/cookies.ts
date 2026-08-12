import { cookies } from "next/headers";

import { ttlToDate, ACCESS_TTL, CUSTOMER_TTL, REFRESH_TTL } from "./jwt";

/**
 * httpOnly auth cookies. Tokens live in cookies (never localStorage) so client
 * JS cannot read them — mitigates XSS token theft. `cookies()` is async in
 * Next.js 16 and must be awaited.
 */

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const isProd = process.env.NODE_ENV === "production";

function baseOptions() {
  return {
    httpOnly: true,
    secure: isProd, // https-only in prod; allow http on localhost in dev
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * `accessTtl` keeps the cookie and the token it carries in step.
 *
 * These were the same value by construction until the access token started
 * taking a configured lifetime. After that they diverged for every value but
 * the default: the token said one thing and the browser threw the cookie away
 * at another, so the setting changed nothing an honest client could feel while
 * still lengthening the window for a replayed token. Defaulted, so callers
 * that do not know the policy keep working.
 */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  accessTtl: string = ACCESS_TTL,
  /**
   * Whether the session should outlive the browser.
   *
   * "Keep me signed in" was collected, validated, and then dropped: the refresh
   * cookie always carried a 30-day `expires`, so unticking it on a shared or
   * public machine changed nothing at all. Closing the browser left a working
   * admin session for the next person to open it.
   *
   * A cookie with no `expires` is a SESSION cookie — the browser discards it
   * when it closes. The server-side session row is untouched either way; this
   * governs how long this BROWSER keeps presenting it.
   *
   * Defaulted true so callers that do not express a preference — the refresh
   * rotation, which must not shorten a session the admin already chose to keep
   * — behave exactly as before.
   */
  rememberMe: boolean = true,
): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, { ...baseOptions(), expires: ttlToDate(accessTtl) });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    ...(rememberMe ? { expires: ttlToDate(REFRESH_TTL) } : {}),
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessCookie(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/**
 * The storefront customer's session.
 *
 * Its own cookie name, so signing out of the admin does not sign a customer out
 * of the shop on the same browser, and so neither can ever be read as the
 * other. httpOnly for the same reason the admin's are: the storefront runs a
 * lot of third-party-ish client code and a token in `localStorage` is one XSS
 * away from being someone else's order history.
 */
export const CUSTOMER_COOKIE = "customer_session";

export async function setCustomerCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, { ...baseOptions(), expires: ttlToDate(CUSTOMER_TTL) });
}

export async function clearCustomerCookie(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

export async function getCustomerCookie(): Promise<string | undefined> {
  return (await cookies()).get(CUSTOMER_COOKIE)?.value;
}
