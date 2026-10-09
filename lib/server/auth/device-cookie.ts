import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

/**
 * A browser this account has signed in from before.
 *
 * The login throttle is keyed on the ACCOUNT, because an address the caller
 * writes can be rotated for free. The cost of that was a lockout anyone could
 * cause: the owner's email is usually the shop's public contact address, and
 * six wrong passwords a minute kept every honest attempt answering 429 for as
 * long as a stranger cared to keep sending them. The same was true of the reset
 * route.
 *
 * So a browser that has signed in successfully carries this cookie, and its
 * attempts are counted against IT rather than against the account. A stranger
 * has no cookie and still meets the account's limit; the owner, on the laptop
 * they always use, never shares a bucket with them. A brand-new device still
 * shares the account's limit — the trade OWASP describes as "device cookies".
 *
 * The value is `nonce.mac`, the MAC binding the nonce to the email, so a cookie
 * minted for one account cannot be replayed against another and cannot be
 * forged without the server's secret.
 */

export const DEVICE_COOKIE = "admin_device";
const DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function secret(): string | null {
  return process.env.JWT_ACCESS_SECRET || null;
}

function mac(email: string, nonce: string, key: string): string {
  return createHmac("sha256", key).update(`${email.trim().toLowerCase()}|${nonce}`).digest("base64url");
}

/** The device's nonce if this browser has signed in to `email` before, else null. */
export async function recognisedDevice(email: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const value = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!value) return null;
  const [nonce, given] = value.split(".");
  if (!nonce || !given) return null;
  const expected = Buffer.from(mac(email, nonce, key));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return nonce;
}

/** Mark this browser as one `email` signs in from. Called after a successful login. */
export async function rememberDevice(email: string): Promise<void> {
  const key = secret();
  if (!key) return;
  const nonce = randomBytes(16).toString("base64url");
  (await cookies()).set(DEVICE_COOKIE, `${nonce}.${mac(email, nonce, key)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + DEVICE_TTL_MS),
  });
}
