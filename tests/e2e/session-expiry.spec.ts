import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * What an admin sees when their session ends under them.
 *
 * Only a browser can tell this fix from the bug. Both branches are in the
 * source either way, and the defect was never a wrong value — it was a screen
 * that went on looking signed in while every request behind it answered 401,
 * emptying one list at a time and reporting each save as "saved on this device
 * only". A structural test cannot see which one paints.
 */

/** Make the next admin read answer as an ended session. */
async function serverEndsTheSession(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    // Everything EXCEPT the login the dialog is about to perform, so the
    // recovery path stays reachable.
    if (url.includes("/api/auth/login")) return route.continue();
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Session timed out", data: null }),
    });
  });
}

test("the admin is told, rather than left on a panel that empties", async ({ page }) => {
  await adminSession(page);
  await page.goto("/admin/inquiries");
  await expect(page.getByRole("heading", { name: /inquiries/i }).first()).toBeVisible();

  await serverEndsTheSession(page);
  // Any admin read will do — the point is that a 401 from ANY api module
  // surfaces, not only the auth heartbeat's.
  await page.goto("/admin/orders");

  await expect(
    page.getByRole("heading", { name: /your session has ended/i }),
    "the session ended and nothing said so",
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

/*
 * STILL NOT COVERED HERE: that a 401 from an ORDINARY api module — rather than
 * the heartbeat — is what raises the dialog.
 *
 * The note that used to stand here said this was impossible in a browser,
 * because “the heartbeat and the fanout ask the same question within
 * milliseconds”. That was WRONG, and being wrong it stood in the file as the
 * reason nobody tried again. `useSessionRefresh` is mounted in the PERSISTENT
 * admin shell, so its effect runs once per FULL page load — and after that
 * mount beat `MIN_GAP_MS` bars another tick for sixty seconds, from the timer,
 * from focus and from visibilitychange alike. Every earlier attempt used
 * goto/reload, which remount the shell and fire a fresh beat.
 *
 * So the shape that should work is: let the mount beat succeed, 401 everything,
 * then move to a screen that FETCHES on mount using a client-side navigation,
 * which leaves the hook mounted. Inside that minute only an api module can put
 * the question.
 *
 * What stopped it: in this harness a click on the sidebar link does not
 * navigate — the link is present and visible, the click lands, and the URL does
 * not change (probed twice, by role and by href). That is a harness problem to
 * solve, not a property that cannot be tested, and the difference matters:
 * the fanout is real behaviour with no browser coverage.
 *
 * Its completeness is held meanwhile by
 * tests/domain/session-expiry-is-announced.test.ts, which fails when a single
 * call site is dropped.
 */

test("the dialog cannot be dismissed back onto the dead panel", async ({ page }) => {
  await adminSession(page);
  await page.goto("/admin/orders");
  await serverEndsTheSession(page);
  await page.reload();

  const heading = page.getByRole("heading", { name: /your session has ended/i });
  await expect(heading).toBeVisible({ timeout: 20_000 });

  // Escape and an outside click are the two ways a Radix dialog normally
  // closes. Either one would strand the admin on a panel where nothing works
  // and nothing explains why.
  await page.keyboard.press("Escape");
  await expect(heading, "Escape dismissed it").toBeVisible();

  await page.mouse.click(5, 5);
  await expect(heading, "an outside click dismissed it").toBeVisible();
});

test("a server that is merely down does not sign anyone out", async ({ page }) => {
  /**
   * The old boolean conflated "this session is over" with "the request never
   * landed". Throwing an admin out mid-edit for a dropped packet is a worse
   * failure than the one being fixed, so a 500 must leave them alone.
   */
  await adminSession(page);
  await page.goto("/admin/orders");

  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Service unavailable", data: null }),
    }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: /orders/i }).first()).toBeVisible();

  await page.waitForTimeout(6000);
  await expect(
    page.getByRole("heading", { name: /your session has ended/i }),
    "a 503 signed the admin out",
  ).toHaveCount(0);
});

test("the server takes the cookie back, so the proxy stops waving the browser through", async ({
  request,
}) => {
  /**
   * `clearAuthCookies()` ran only in `logout`. Every other way a session ends
   * deleted the row and threw, leaving the browser holding a refresh cookie —
   * and `proxy.ts` gates /admin on that cookie's presence alone, so it kept
   * letting the browser in.
   */
  const res = await request.post("/api/auth/refresh", {
    headers: { cookie: "refresh_token=not-a-real-token" },
    failOnStatusCode: false,
  });

  expect(res.status(), "an unreadable token was accepted").toBe(401);

  /**
   * The REFRESH cookie's own header, not all of them joined.
   *
   * Joining every Set-Cookie meant `/refresh_token=/` could match one header
   * while the deletion marker came from a different one — so clearing only the
   * access cookie would have passed the pair.
   */
  const refreshHeader = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((value) => value.startsWith("refresh_token="));

  expect(refreshHeader, "the refresh cookie was left in the browser").toBeTruthy();
  // A deletion is expressed as an immediate expiry or an empty value.
  expect(refreshHeader!).toMatch(/refresh_token=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i);
});
