import { expect, test } from "@playwright/test";

import { connect } from "./shop-state";

/**
 * The category pages, in a browser.
 *
 * This shop's three wedding cakes cost ₹12,499, ₹15,999 and ₹18,999, and the
 * price filter's ceiling was a constant 5,000 that was also its default. So
 * /store/collections/wedding matched all three products and then removed all
 * three, and the page rendered "No Cakes found" — with the Filters badge
 * reporting that no filter was active.
 *
 * No unit test would have caught it end to end: the filter function was doing
 * exactly what it was told, by a default that was wrong.
 */
test.describe("browsing a category", () => {
  test("shows the wedding cakes, which cost more than the old filter ceiling", async ({ page }) => {
    await page.goto("/store/collections/wedding");

    // The heading is the category's, so an empty grid here is a category page
    // that says it has cakes and shows none.
    await expect(page.getByRole("heading", { name: /wedding/i }).first()).toBeVisible();

    const cards = page.locator('a[href^="/store/cakes/"]');
    await expect(cards.first(), "the wedding cakes were filtered off their own page").toBeVisible();

    // And they are the expensive ones — the count line is the shop's own claim
    // about how many it is showing.
    await expect(page.getByText(/showing [1-9]\d* of [1-9]\d*/i)).toBeVisible();
  });

  test("does not claim a filter is active when the slider is at the top", async ({ page }) => {
    await page.goto("/store/collections");

    // The desktop panel labels the slider's position. At the top it must not
    // read as a limit — "Up to ₹19,000" next to an unfiltered grid says the
    // customer is being shown a subset when they are not.
    await expect(page.getByText(/any price/i).first()).toBeVisible();
  });

  test("offers the shop's own categories, not the ones that shipped", async ({ page }) => {
    // The pills were `categories` from landing-data — the demo taxonomy. This
    // shop's catalogue has categories that list does not (Chocolate, Premium,
    // Classic), so they had no pill and could only be reached by URL.
    const db = await connect();
    const catalog = await db.collection("catalogs").findOne({});
    const own = ((catalog?.categories ?? []) as { name: string; slug: string }[]).filter(
      (item) => item.slug,
    );
    expect(own.length, "this shop has no categories to test with").toBeGreaterThan(0);

    await page.goto("/store/collections");

    // Scoped to the pill group. An earlier version counted every link on the
    // page, so unrelated links to a collection made it fail for a reason that
    // had nothing to do with the pills.
    const pills = page.getByRole("navigation", { name: "Categories" });
    await expect(pills).toBeVisible();

    // Every category the shop has, offered. Checked by name so a rename shows.
    for (const category of own) {
      await expect(
        pills.getByRole("link", { name: category.name, exact: true }),
        `${category.name} is missing from the category pills`,
      ).toBeVisible();
    }

    // And no duplicates — the list is admin-typed and this shop has two rows
    // sharing a slug.
    const hrefs = await pills
      .locator("a")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    expect(new Set(hrefs).size, "the same category is offered twice").toBe(hrefs.length);
  });

  test("still filters when the slider is moved down", async ({ page }) => {
    await page.goto("/store/collections/wedding");
    await expect(page.locator('a[href^="/store/cakes/"]').first()).toBeVisible();

    // Driven by the keyboard. `fill()` sets the DOM value without firing the
    // change React listens for, so the slider read 19,000 and this test passed
    // or failed for reasons that had nothing to do with filtering. Home takes
    // the range input to its minimum through a real input event.
    const slider = page.getByLabel(/maximum price/i).first();
    await slider.press("Home");
    await expect(slider, "the slider did not actually move").toHaveValue("0");

    // Nothing costs nothing, so this genuinely empties the page — and the page
    // must say so, rather than falling back to showing the whole catalogue.
    await expect(page.getByText(/no cakes found/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible();
  });
});
