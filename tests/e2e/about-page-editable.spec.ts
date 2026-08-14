import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * The About page shows the shop's own words, or nothing.
 *
 * Its template hardcoded the demo brand's history — "Since 1965", "1M+ Happy
 * customers", "500+ Cake varieties", four cards claiming six decades of
 * expertise and same-day delivery across 500+ cities — and rendered it as
 * whichever bakery was running the CMS, with no field anywhere to change it.
 *
 * Only a browser can show what the page actually says: the source contains
 * every branch either way.
 */

test("says nothing the shop has not said itself", async ({ page }) => {
  await page.goto("/store/about");

  const body = (await page.locator("body").textContent()) ?? "";

  for (const claim of [
    "Since 1965",
    "1M+",
    "500+ Cake varieties",
    "Six decades of craft",
    "Order by 2 PM",
  ]) {
    expect(body, `the About page still claims "${claim}"`).not.toContain(claim);
  }

  // The page itself still works — this is not an empty page, it is a page
  // without invented claims. Its title and its editable prose remain.
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("the admin can put the shop's own figures back", async ({ page }) => {
  await adminSession(page);

  // Straight to the seeded About page's editor. The list renders rows with a
  // menu rather than a link, and which row is which is not this test's subject.
  // Asked through the admin's own API rather than the database, so this does
  // not depend on a collection name.
  const response = await page.request.get("/api/pages");
  expect(response.status()).toBe(200);
  const pages = ((await response.json())?.pages ?? []) as { id: string; template: string }[];
  const aboutPage = pages.find((entry) => entry.template === "about");
  expect(aboutPage, "no About-template page in this shop to edit").toBeTruthy();

  await page.goto(`/admin/pages/${aboutPage!.id}/edit`);

  // The About-only editor appears for this template, with the old copy offered
  // as a hint rather than a value.
  const badge = page.getByLabel(/badge over the hero image/i);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveValue("");
  await expect(badge).toHaveAttribute("placeholder", "Since 1965");

  // Adding a stat row is possible, and it starts empty.
  await page.getByRole("button", { name: /add stat/i }).click();
  await expect(page.getByLabel("Stat figure").first()).toHaveValue("");
});
