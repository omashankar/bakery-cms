import { SignJWT, jwtVerify } from "jose";

/**
 * JWT signing/verification with jose (works in both Node and Edge runtimes).
 * Two token types with separate secrets so a leaked access secret can't mint
 * refresh tokens:
 *   - access  (short-lived, ~15m) — authorises API calls
 *   - refresh (long-lived, ~30d)  — mints new access tokens, rotated on use
 */

export type TokenType = "access" | "refresh";

export interface AccessClaims {
  sub: string; // userId
  role: string; // role slug
  email: string;
  type: "access";
}

export interface RefreshClaims {
  sub: string; // userId
  sid: string; // sessionId
  type: "refresh";
  /**
   * Whether the browser was told to keep this session past a restart.
   *
   * It has to travel WITH the token. A rotation re-issues the cookie, and the
   * server cannot read back the expiry of the cookie it is replacing — so
   * without this the rotation fell back to the default and stamped a 30-day
   * lifetime on a session an admin had deliberately made browser-only. One
   * background refresh silently undid the choice.
   *
   * Optional: tokens minted before this existed carry no flag, and those
   * sessions were 30-day by definition, so `undefined` reads as remembered.
   */
  remember?: boolean;
}

/**
 * Whether a rotation should keep the session past a browser restart.
 *
 * One expression, in one place, because the two readings differ only by a
 * negation and the wrong one is silent: `claims.remember === true` would
 * downgrade every session minted before the claim existed to browser-only on
 * its next background refresh, signing those admins out with nothing to
 * indicate why.
 */
export function isRemembered(claims: Pick<RefreshClaims, "remember">): boolean {
  return claims.remember !== false;
}

/**
 * A signed-in STOREFRONT customer. Not a user of the admin.
 *
 * `type: "customer"` is inside the signed payload, and every verifier here
 * checks it, so a customer token can never be accepted where an access token is
 * expected — `verifyAccessToken` returns null on it — and vice versa. That type
 * check, not the choice of secret, is what keeps the two apart.
 *
 * There is no role: a customer's authority is exactly "their own orders", which
 * is decided by `sub`/`email`, never by a claim the token carries.
 */
export interface CustomerClaims {
  sub: string; // customerAccountId
  email: string;
  type: "customer";
}

function secretFor(type: TokenType): Uint8Array {
  const raw =
    type === "access" ? process.env.JWT_ACCESS_SECRET : process.env.JWT_REFRESH_SECRET;
  if (!raw) {
    throw new Error(
      `${type === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET"} is not set in .env.local`,
    );
  }
  return new TextEncoder().encode(raw);
}

export const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL || "30d";

/**
 * `ttl` lets the caller apply the shop's configured session timeout.
 *
 * The Security screen has had a "Session timeout" field since before this
 * function existed, and nothing read it — every session was 15 minutes
 * whatever the admin chose. Defaulted rather than required so that the paths
 * which do not know the policy (a token refresh deep in a request) keep
 * working unchanged.
 */
export async function signAccessToken(
  claims: Omit<AccessClaims, "type">,
  ttl: string = ACCESS_TTL,
): Promise<string> {
  return new SignJWT({ ...claims, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretFor("access"));
}

export async function signRefreshToken(claims: Omit<RefreshClaims, "type">): Promise<string> {
  return new SignJWT({ ...claims, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secretFor("refresh"));
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretFor("access"), { algorithms: ["HS256"] });
    return payload.type === "access" ? (payload as unknown as AccessClaims) : null;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretFor("refresh"), { algorithms: ["HS256"] });
    return payload.type === "refresh" ? (payload as unknown as RefreshClaims) : null;
  } catch {
    return null;
  }
}

/**
 * How long a customer stays signed in on the storefront.
 *
 * Long, deliberately: a shopper is not an administrator, the token authorises
 * nothing but their own order history, and being logged out between placing an
 * order and coming back to track it is the thing the account exists to fix.
 */
export const CUSTOMER_TTL = process.env.JWT_CUSTOMER_TTL || "30d";

/**
 * Its own secret when one is configured, the access secret otherwise.
 *
 * Sharing is safe here in a way that sharing between access and refresh is not:
 * those two differ only by intent, so a leaked access secret minting refresh
 * tokens would be an escalation. A customer token is strictly LESS authority
 * than an access token, and anyone able to sign one could sign an admin token
 * instead. `JWT_CUSTOMER_SECRET` is honoured for installs that want the
 * separation anyway, and no existing install has to add an env var to get
 * customer accounts working.
 */
function customerSecret(): Uint8Array {
  const raw = process.env.JWT_CUSTOMER_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!raw) {
    throw new Error("JWT_CUSTOMER_SECRET or JWT_ACCESS_SECRET is not set in .env.local");
  }
  return new TextEncoder().encode(raw);
}

export async function signCustomerToken(
  claims: Omit<CustomerClaims, "type">,
  ttl: string = CUSTOMER_TTL,
): Promise<string> {
  return new SignJWT({ ...claims, type: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(customerSecret());
}

export async function verifyCustomerToken(token: string): Promise<CustomerClaims | null> {
  try {
    const { payload } = await jwtVerify(token, customerSecret(), { algorithms: ["HS256"] });
    return payload.type === "customer" ? (payload as unknown as CustomerClaims) : null;
  } catch {
    return null;
  }
}

/** Convert a "30d" / "15m" style TTL to a future Date. */
export function ttlToDate(ttl: string): Date {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  const now = Date.now();
  if (!match) return new Date(now + 15 * 60 * 1000);
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 60_000;
  return new Date(now + value * unitMs);
}
