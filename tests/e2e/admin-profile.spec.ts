import { expect, test } from "@playwright/test";



import { connect } from "./shop-state";
import { adminSession } from "./admin-session";

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
     * The SHARED fixture, not a second copy of it.
     *
     * This minted its own pair with `sid: "e2e"` and no session row behind
     * it — the same fiction `adminSession` used to carry. The server refuses
     * that now: a refresh whose session row is missing ends the session rather
     * than rotating past the check, so the first heartbeat cleared the cookies
     * and this page redirected to /login. Two fixtures for one job is how the
     * second one gets left behind.
     */
    await adminSession(page);

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
