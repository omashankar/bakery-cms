import { expect, test, type APIRequestContext } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * What an anonymous request can read.
 *
 * Three endpoints in this codebase answer a public GET with data an admin
 * edits, and two of them were already narrowed so a visitor gets only what a
 * visitor may see:
 *
 *   /api/coupons     — active, unexpired codes only. "It used to hand out the
 *                      shop's whole discount table, switched-off and unlaunched
 *                      codes included."
 *   /api/content/*   — approved testimonials and published FAQs only. "It used
 *                      to return the whole stored array … complete with the
 *                      launch time of a campaign the shop had not announced."
 *
 * The third, /api/delivery-zones, never got that treatment and still returns
 * every zone including the ones the shop has switched off, with the price it
 * used to charge for them.
 *
 * /api/site-layout/* is a fourth shape: no scoping at all, and no need for a
 * public read either. Its twin /api/admin-config/* answers 401, the storefront
 * reads the service in-process rather than over HTTP, and the SEO hydration
 * gate's own doc comment is written around this read "401-ing" when anonymous —
 * which it had stopped doing.
 *
 * These run without any cookie: `request` is a fresh context, not the browser's.
 */

const json = async (request: APIRequestContext, url: string) => {
  const response = await request.get(url);
  return { status: response.status(), body: response.ok() ? await response.json() : null };
};

test("delivery zones the shop switched off are not handed to visitors", async ({ request }) => {
  const { status, body } = await json(request, "/api/delivery-zones");
  expect(status).toBe(200);

  const zones = (body?.data ?? []) as { name: string; isActive: boolean }[];
  expect(Array.isArray(zones), "delivery zones did not come back as a list").toBe(true);

  const off = zones.filter((zone) => zone.isActive === false);
  expect(
    off.map((zone) => zone.name),
    "switched-off zones, and what the shop used to charge for them, are public",
  ).toEqual([]);
});

test("an admin still sees every zone, including the switched-off ones", async ({ page }) => {
  // The other half: narrowing the public read must not blind the admin screen
  // that exists to manage exactly those records.
  await adminSession(page);

  const response = await page.request.get("/api/delivery-zones");
  expect(response.status()).toBe(200);
  const zones = ((await response.json())?.data ?? []) as { isActive: boolean }[];

  expect(
    zones.some((zone) => zone.isActive === false),
    "the admin can no longer see the zones it is their job to switch back on",
  ).toBe(true);
});

test("site layout is not readable without signing in", async ({ request }) => {
  // Its twin /api/admin-config/* already answers 401 to this exact shape.
  for (const key of ["seo", "header", "footer", "appearance"]) {
    const response = await request.get(`/api/site-layout/${key}`);
    expect(response.status(), `/api/site-layout/${key} is world-readable`).toBe(401);
  }
});

test("the admin screens that read site layout still can", async ({ page }) => {
  await adminSession(page);

  for (const key of ["seo", "header", "footer", "appearance"]) {
    const response = await page.request.get(`/api/site-layout/${key}`);
    expect(response.status(), `/api/site-layout/${key} is closed to the admin too`).toBe(200);
  }
});

test("the storefront still renders its header, footer and nav", async ({ page }) => {
  // The guard above is only safe because the storefront reads the service
  // in-process. If that were wrong, this is where it would show.
  await page.goto("/store");

  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("footer").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /collections/i }).first()).toBeVisible();
});
