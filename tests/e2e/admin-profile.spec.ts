import { expect, test } from "@playwright/test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SignJWT } from "jose";

import { connect } from "./shop-state";

/** The signing secret, from the same .env.local the server reads. */
function readEnv(): Record<string, string> {
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

/**
 * Admin → Profile, with the account fields the server has not answered for.
 *
 * `persistServerAccount` fills `lastLogin` and `createdAt` from
 * `/api/auth/me`, and is deliberately outside the hydration gate — "a failed
 * read leaves them blank rather than blocking a save". So when that call
 * returns null (an expired token, a 401, a network blip) the gate opens and the
 * page renders `formatDate("")`, which threw `RangeError: Invalid time value`
 * and took the whole route down.
 *
 * This drives the real screen with that request failing, which is the only way
 * to reproduce the state a unit test can only describe.
 */
test.describe("the admin profile page", () => {
  test("renders when the server has not said when the admin last logged in", async ({ page }) => {
    const db = await connect();
    const user = await db.collection("users").findOne({});
    expect(user, "no admin user to sign in as").toBeTruthy();

    /**
     * An admin session, minted rather than logged into.
     *
     * The admin's password is not something a test should hold, and an
     * ADMIN_PASSWORD env var would just move the problem. The token is signed
     * with the same secret and the same claims `signAccessToken` uses, so the
     * server validates it exactly as it validates a real login — this skips the
     * password, not the authentication.
     */
    const secret = new TextEncoder().encode(readEnv().JWT_ACCESS_SECRET);
    const token = await new SignJWT({
      sub: String(user!._id),
      role: String(user!.role ?? "owner"),
      email: String(user!.email),
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secret);

    /**
     * BOTH cookies. `proxy.ts` gates /admin on the presence of the REFRESH
     * cookie — an optimistic check that does no database work — while the DAL
     * authenticates with the ACCESS one. Setting only the access token gets you
     * redirected to /login before anything reads it, which is how the first
     * version of this test ended up asserting against the sign-in page.
     */
    const refresh = await new SignJWT({ sub: String(user!._id), sid: "e2e", type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(readEnv().JWT_REFRESH_SECRET));

    await page.context().addCookies([
      { name: "access_token", value: token, url: "http://localhost:3000" },
      { name: "refresh_token", value: refresh, url: "http://localhost:3000" },
    ]);

    /**
     * The state that crashed: a user the server answers for, with no dates on
     * them.
     *
     * That is a real document — an admin seeded straight into the collection
     * has no `lastLoginAt` until they log in through the API — and it is what
     * `persistServerAccount` turns into `lastLogin: ""`.
     *
     * Answered rather than aborted: aborting this call does not merely blank
     * the dates, it signs the admin out and redirects to /login, so it tests
     * the wrong thing entirely. An earlier version of this test did that and
     * failed on the sign-in page.
     */
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: String(user!._id),
            email: user!.email,
            name: user!.name,
            role: user!.role ?? "owner",
            status: user!.status ?? "active",
            // No lastLoginAt, no createdAt.
          },
        }),
      });
    });

    const crashes: string[] = [];
    page.on("pageerror", (error) => crashes.push(error.message));

    await page.goto("/admin/profile");

    await expect(
      page.getByRole("heading", { name: /my profile/i }),
      "the profile page did not render",
    ).toBeVisible({ timeout: 20_000 });

    expect(
      crashes.filter((message) => /Invalid time value/i.test(message)),
      "the page threw on a date it did not have",
    ).toEqual([]);

    // And it says it does not know, rather than inventing a plausible date.
    await expect(page.getByText(/last login/i).first()).toBeVisible();
  });
});
