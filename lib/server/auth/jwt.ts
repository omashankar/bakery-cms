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

export async function signAccessToken(claims: Omit<AccessClaims, "type">): Promise<string> {
  return new SignJWT({ ...claims, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
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

/** Convert a "30d" / "15m" style TTL to a future Date. */
export function ttlToDate(ttl: string): Date {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  const now = Date.now();
  if (!match) return new Date(now + 15 * 60 * 1000);
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 60_000;
  return new Date(now + value * unitMs);
}
