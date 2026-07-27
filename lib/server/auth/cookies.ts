import { cookies } from "next/headers";

import { ttlToDate, ACCESS_TTL, REFRESH_TTL } from "./jwt";

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

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, { ...baseOptions(), expires: ttlToDate(ACCESS_TTL) });
  store.set(REFRESH_COOKIE, refreshToken, { ...baseOptions(), expires: ttlToDate(REFRESH_TTL) });
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
