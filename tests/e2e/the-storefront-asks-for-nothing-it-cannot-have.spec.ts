import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * A customer's browser should never be refused by this shop's own API.
 *
 * `SettingsServerSync` lives in the ROOT providers, so it runs on every
 * storefront page as well as in the admin — and it read `/api/settings`, which
 * requires a settings role. For a visitor that can only ever answer 401. Two of
 * them on every page view, two red lines in the console of every customer who
 * ever opens devtools, and a `noteAuthStatus(401)` pushing the session tracker
 * into "checking" on a page with no session to check. The public subset that
 * follows is what the storefront actually uses.
 *
 * This is the same class the root providers' own comment already records for
 * `SiteLayoutServerSync`, which was removed from there for exactly this reason.
 * A guard rather than a fix note, because the next sync added to those providers
 * will be added by someone who has not read that comment.
 *
 * Only a browser can catch it: the requests are made by an effect after
 * hydration, so nothing about reading the source says which of them get refused.
 */

const STOREFRONT_PAGES = ["/store", "/store/collections", "/store/contact"];

/** Every response the page took that the server refused. */
async function refusedRequests(page: Page, path: string): Promise<string[]> {
  const refused: string[] = [];

  const onResponse = (response: import("@playwright/test").Response) => {
    // 404s on a page's own optional assets are a different subject; this is
    // about API calls the browser was not entitled to make.
    if (response.status() >= 400 && response.url().includes("/api/")) {
      refused.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
    }
  };

  page.on("response", onResponse);
  await page.goto(path, { waitUntil: "networkidle" });
  // The syncs run in effects after hydration, so the navigation resolving is
  // not enough — without this wait the assertion passes before they fire.
  await page.waitForTimeout(2500);
  page.off("response", onResponse);

  return refused;
}

test.describe("the storefront", () => {
  for (const path of STOREFRONT_PAGES) {
    test(`makes no API request it is not entitled to on ${path}`, async ({ page }) => {
      const refused = await refusedRequests(page, path);

      expect(refused, `a visitor's browser was refused: ${refused.join(", ")}`).toEqual([]);
    });
  }
});

test.describe("the admin", () => {
  test("still reads the full settings, which the storefront no longer asks for", async ({ page }) => {
    /**
     * The other half of the change, and the one that would break quietly.
     *
     * Only a FULL read opens the settings hydration gate, and a shut gate makes
     * every settings save report "saved on this device only". If the storefront
     * fix had simply removed the privileged read, nothing here would fail until
     * an admin tried to save.
     */
    await adminSession(page);

    const settingsRead = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/settings" && response.request().method() === "GET",
      { timeout: 30_000 },
    );

    await page.goto("/admin/dashboard", { waitUntil: "networkidle" });

    const response = await settingsRead;
    expect(response.status(), "the admin's full settings read was refused").toBe(200);
  });
});
