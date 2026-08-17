import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { SignJWT } from "jose";

import { connect } from "./shop-state";

/**
 * Sign a test into the admin, without holding the admin's password.
 *
 * The tokens are signed with the same secrets and the same claims the server
 * mints, so it validates them exactly as it validates a real login — this skips
 * the password, not the authentication.
 *
 * BOTH cookies are needed. `proxy.ts` gates /admin on the presence of the
 * REFRESH cookie — an optimistic check that does no database work — while the
 * DAL authenticates with the ACCESS one. Setting only the access token gets you
 * redirected to /login before anything reads it.
 */
export async function adminSession(page: Page): Promise<{ email: string }> {
  const db = await connect();
  const user = await db.collection("users").findOne({});
  expect(user, "no admin user in the database to sign in as").toBeTruthy();

  const env = readEnv();
  const access = await new SignJWT({
    sub: String(user!._id),
    role: String(user!.role ?? "owner"),
    email: String(user!.email),
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));

  /**
   * A session the SERVER also knows about.
   *
   * The refresh token used to carry `sid: "e2e"` with nothing behind it, so the
   * very first heartbeat took the reuse/revoked branch — `findActiveRefreshToken`
   * found no row — and the server ended the session before any test had done
   * anything. Every browser test therefore ran against a session that was
   * already dead: the expiry dialog appeared on its own, which made it
   * impossible to prove that anything ELSE raised it, and quietly weakened
   * every other spec that assumed it was signed in.
   *
   * Fixed ids, upserted, so repeated runs reuse one row rather than piling up.
   */
  const sessionId = new ObjectId("000000000000000000000e2e");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.collection("sessions").updateOne(
    { _id: sessionId },
    {
      $set: {
        userId: user!._id,
        userAgent: "playwright",
        ip: "127.0.0.1",
        lastSeenAt: new Date(),
        expiresAt,
      },
    },
    { upsert: true },
  );

  const refresh = await new SignJWT({
    sub: String(user!._id),
    sid: String(sessionId),
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(env.JWT_REFRESH_SECRET));

  // The server stores only the hash, and matches on it — same digest here.
  const tokenHash = createHash("sha256").update(refresh).digest("hex");
  await db.collection("refreshtokens").updateOne(
    { tokenHash },
    {
      $set: {
        userId: user!._id,
        sessionId,
        tokenHash,
        expiresAt,
        revokedAt: null,
      },
    },
    { upsert: true },
  );

  await page.context().addCookies([
    { name: "access_token", value: access, url: "http://localhost:3000" },
    { name: "refresh_token", value: refresh, url: "http://localhost:3000" },
  ]);

  return { email: String(user!.email) };
}

/** The signing secrets, from the same .env.local the server reads. */
export function readEnv(): Record<string, string> {
  const lines = readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/);
  const entries = lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      const key = line.slice(0, at).trim();
      const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
      return [key, value] as const;
    });
  return Object.fromEntries(entries);
}
