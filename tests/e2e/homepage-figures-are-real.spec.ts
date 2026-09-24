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
   * EVERY SCORE ON THE PAGE IS THE SHOP'S, AND THERE MAY BE NONE.
   *
   * This demanded the chip itself, the rendered words "4.5 Rating". That was
   * right while the hero carried one. `d7ded01` took the hero's three strips
   * out at the shop's request and the rating chip went with them: nothing in
   * `homepage-section-renderer.tsx` reads `trust.rating` any more, and
   * `homepage-states-the-shops-own-figures.test.ts` records the same removal.
   * So this was failing on a deletion the shop asked for rather than on a lost
   * figure, and had been red since that commit without anyone reading it.
   *
   * What still has to hold is the half that was never about the chip: a score
   * printed here is the shop's own, or it is not printed. Scanning rather than
   * asserting presence keeps that true whichever way the strip goes — put a
   * literal 4.9 back on any band and this goes red, which is the failure it
   * exists for.
   */
  const scores = [...body.matchAll(/(\d+(?:\.\d+)?)\s*Rating/g)].map((m) => Number(m[1]));

  if (approved.length === 0) {
    expect(scores, "a shop with no approved reviews still shows a rating").toEqual([]);
    return;
  }

  const average =
    Math.round((approved.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / approved.length) * 10) /
    10;

  for (const score of scores) {
    expect(score, `the page prints ${score}, and the shop's own score is ${average}`).toBe(average);
  }
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

  /**
   * THE FREE-DELIVERY TILE IS NOT ON THIS PAGE, AND THE WORDS ARE NOT ITS OWN.
   *
   * This required "On orders over ₹<threshold>" somewhere in the body. Two
   * things had moved under it. `d7ded01` took the hero's delivery-facts strip
   * off at the shop's request, and `heroTrustBarFor` — the only thing that
   * ever rendered that tile — has had no caller since. And the phrase it
   * matched on stopped being unique: `coupon-offers.ts` builds "On orders over
   * ₹X" for a COUPON's minimum spend, so this shop's page carries "On orders
   * over ₹10,000" for a coupon while its threshold is ₹999. The old assertion
   * would have passed on a coupon that happened to be worth ₹999 and failed on
   * a shop whose coupons read anything else. It was measuring the wrong
   * sentence.
   *
   * The guard that survives is the one the title claims: free delivery is
   * offered at the shop's own figure, or not spoken of. A coupon's minimum is a
   * different promise and is left alone — a figure counts here only when it
   * sits inside a free-delivery claim.
   */
  const claims = [
    ...body.matchAll(/[Ff]ree [Dd]elivery[^₹]{0,40}₹\s*([\d,]+)/g),
    ...body.matchAll(/₹\s*([\d,]+)[^₹]{0,40}?free delivery/gi),
  ].map((m) => Number(m[1].replace(/,/g, "")));

  for (const claimed of claims) {
    expect(
      claimed,
      `the page promises free delivery over ₹${claimed}; the shop's threshold is ₹${threshold}`,
    ).toBe(threshold);
  }

  // A shop that delivers free on every order may not put a floor under it.
  if (threshold === 0) {
    expect(claims, "a shop with no threshold still names one").toEqual([]);
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
