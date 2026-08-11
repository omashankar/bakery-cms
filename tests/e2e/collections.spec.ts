import { expect, test } from "@playwright/test";

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
