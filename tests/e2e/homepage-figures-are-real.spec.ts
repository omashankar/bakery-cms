import { expect, test } from "@playwright/test";

import { connect } from "./shop-state";

/**
 * The homepage states the shop's own numbers, or none.
 *
 * The hero chip said "4.9 Rating · 2000+ reviews" and the trust bar said
 * "Same-Day Delivery · Order today, get today" and "Free Delivery · On orders
 * over ₹999" — all constants, on every shop running this CMS. Two were wrong
 * when this was written: the rating was 4.7 across 27 approved reviews, and
 * deliveryLeadDays is 1, so same-day is impossible.
 *
 * Only a browser can settle this: the source holds both branches either way.
 */

test("shows the review score the shop actually has", async ({ page }) => {
  const db = await connect();
  const approved = await db.collection("reviews").find({ status: "approved" }).toArray();

  await page.goto("/store");
  const body = (await page.locator("body").textContent()) ?? "";

  // Neither branch may borrow the demo brand's figures.
  expect(body, "the hero still advertises the invented review count").not.toContain("2000+ reviews");
  expect(body, "the hero still advertises the invented score").not.toContain("4.9 Rating");

  /**
   * The empty branch, which this used to assert its way out of.
   *
   * It opened with `expect(approved.length).toBeGreaterThan(0)` — a precondition
   * dressed as an assertion. The moment the shop's seeded demo reviews were
   * deleted, leaving it with none, the test reported the HOMEPAGE as broken when
   * the page was doing exactly what `hero-carousel.tsx` documents: a shop with
   * nothing approved shows no chip rather than borrowing a score. That branch was
   * the untested half of this test's own title, so it is asserted rather than
   * skipped — a shop with no reviews must advertise no rating at all.
   */
  if (approved.length === 0) {
    expect(body, "a shop with no approved reviews still shows a rating chip").not.toMatch(
      /\d+(\.\d+)?\s*Rating/,
    );
    return;
  }

  const average =
    Math.round((approved.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / approved.length) * 10) /
    10;

  expect(body, `the real score (${average}) is not on the page`).toContain(`${average} Rating`);
  expect(body).toContain(`${approved.length} review`);
});

test("promises the delivery speed the shop is set to", async ({ page }) => {
  const db = await connect();
  const settings = await db.collection("settings").findOne({});
  const leadDays = Number(
    (settings?.commerce as { deliveryLeadDays?: number } | undefined)?.deliveryLeadDays ?? 1,
  );

  await page.goto("/store");
  const body = (await page.locator("body").textContent()) ?? "";

  expect(body, "the trust bar still says the shop delivers today").not.toContain(
    "Order today, get today",
  );

  if (leadDays >= 1) {
    /**
     * The tile and card TITLES, which the renderer owns.
     *
     * Case-sensitive and exact on purpose. The shop's published FAQ still
     * answers "Same-day delivery is available for orders placed before 2 PM" —
     * that is its own editable content, seeded into Mongo long ago, and
     * rewriting it behind the shop's back would be a worse defect than the one
     * being fixed. The seed no longer ships that answer, so new installs do not
     * inherit it; this shop's admin can correct theirs.
     */
    expect(body, "a next-day shop still advertises same-day delivery").not.toContain(
      "Same-Day Delivery",
    );
  }

  // And it states the speed it can actually manage. Spelled out rather than
  // imported: pulling in the helper drags the browser-only settings modules
  // into this node context, which cannot resolve them.
  const expected =
    leadDays <= 0
      ? "Same-day delivery"
      : leadDays === 1
        ? "Next-day delivery"
        : `Delivery from ${leadDays} days ahead`;
  expect(body, `the page does not state "${expected}"`).toContain(expected);
});

test("states the free-delivery threshold from settings, not a constant", async ({ page }) => {
  const db = await connect();
  const settings = await db.collection("settings").findOne({});
  const threshold = Number(
    (settings?.commerce as { freeDeliveryThreshold?: number } | undefined)?.freeDeliveryThreshold ??
      0,
  );

  await page.goto("/store");
  const body = (await page.locator("body").textContent()) ?? "";

  if (threshold > 0) {
    // The figure has to match the setting, whatever it is — the point is that
    // it tracks, not that it happens to read 999 today.
    expect(body).toMatch(new RegExp(`On orders over\\s*₹\\s*${threshold}`));
  } else {
    expect(body).toContain("On every order");
  }
});

test("no longer advertises the demo brand's unverifiable boasts", async ({ page }) => {
  /**
   * The hero strip read "1M+ Happy customers · 500+ Cake varieties · 60+ Years
   * of joy" and the Why-Choose-Us cards claimed "Over six decades of baking
   * expertise" — the demo brand's history, shown as whichever shop runs this
   * CMS, with no field anywhere to change them.
   *
   * They are editable section content now, and an empty list renders no strip
   * and no section rather than someone else's past.
   */
  await page.goto("/store");
  const body = (await page.locator("body").textContent()) ?? "";

  for (const boast of [
    "1M+",
    "Happy customers",
    "500+ Cake varieties",
    "Years of joy",
    "Over six decades of baking expertise",
  ]) {
    expect(body, `the homepage still boasts "${boast}"`).not.toContain(boast);
  }

  // And the page still works — this is a page without invented claims, not an
  // empty one. The hero headline and the product rails are untouched.
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /collections|shop/i }).first()).toBeVisible();
});
