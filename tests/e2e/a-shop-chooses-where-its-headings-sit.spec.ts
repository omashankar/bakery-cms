import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * THE HEADING REALLY MOVES — measured, on every shape of row this shop has.
 *
 * The unit test beside this one proves the setting is wired. Wiring is not the
 * hard part: on nine of these section types the heading is a flex child that
 * hugs its own text, and `text-center` on a box the width of its own words
 * moves nothing at all. Measured before the rows were reshaped, setting the
 * tabbed rail to centre and then to right put the heading in the same place
 * both times — a live dropdown, doing nothing, with a green suite.
 *
 * NOTHING IS WRITTEN TO THE SHOP. The builder GETs its layout from
 * /api/homepage-sections and renders it with the same renderer the storefront
 * uses, so a crafted answer to that one request is a whole homepage with the
 * setting under test in it, and the database is never touched.
 */

/**
 * THE SHOP'S OWN LAYOUT, WITH ONE KEY CHANGED.
 *
 * A hand-written layout was the first attempt and five of its six bands drew
 * nothing: a tabbed rail with no tabs, a price row with no cards and a banner
 * strip with no artwork all render null, correctly. The test then measured one
 * band and would have called it every shape.
 *
 * So the real published layout is fetched and handed straight back with
 * `align` set on every section. Whatever shapes this shop has are the ones
 * measured.
 */
async function layoutWith(page: Page, align: string) {
  const answer = await page.request.get("/api/homepage-sections");
  expect(answer.ok(), "could not read the shop's own layout").toBe(true);

  const state = (await answer.json()).state;
  const paint = (snapshot: { sections: Record<string, unknown>[] }) => ({
    ...snapshot,
    sections: snapshot.sections.map((section) => ({
      ...section,
      content: { ...(section.content as Record<string, unknown>), align },
    })),
  });

  return {
    state: { ...state, draft: paint(state.draft), published: paint(state.published) },
  };
}

/** Where each heading's WORDS sit, against the middle of its own band. */
async function headings(page: Page) {
  return page.evaluate(() => {
    const out: { id: string; left: number; right: number; width: number }[] = [];
    /*
      THE FOUR THAT WERE NEVER OFFERED THE CHOICE. `hero` has no section
      heading; store-locator, newsletter and cta draw their own <h2> inside a
      card whose `text-center` also centres the buttons and the form beneath
      it. The probe paints `align` onto every section in the layout, so
      without this they fail for obeying the rule rather than breaking it.
    */
    const NO_CONTROL = ["hero", "store-locator", "newsletter", "cta"];

    for (const band of document.querySelectorAll("[data-section-id]")) {
      const id = band.getAttribute("data-section-id") ?? "";
      if (NO_CONTROL.some((type) => id.startsWith(type))) continue;
      const heading = band.querySelector("h2");
      if (!heading || !heading.firstChild) continue;
      /*
        THE TEXT, NOT THE BOX IT SITS IN. The box is `flex-1` in half these
        rows, so it spans the band whichever edge the words are against —
        measuring it would report "nothing moved" for a heading that had moved
        the full width of the page. That mistake was made once already on this
        page, on the banner strip.
      */
      const range = document.createRange();
      range.selectNodeContents(heading);
      /*
        THE FIRST LINE, not the union of all of them. A heading that wraps
        has a union rect nearly as wide as its container whichever edge the
        words are against, so the air either side comes out equal and every
        alignment reads as centred. Measured: the second price-cards band,
        whose heading wraps in the 624px preview, showed 130px and 146px
        while ranged hard right.
      */
      const text = range.getClientRects()[0];
      const shell = band.getBoundingClientRect();
      if (!text || text.width < 1 || shell.width < 1) continue;
      /*
        THE TWO GAPS, not a fraction of the band. A first draft asked for
        the heading's centre to be more than a quarter of the band from the
        middle, and a long heading in the builder's 624px preview panel
        cannot get that far however hard it is pushed: "Seasonal Collection"
        flush against the left edge is only 149px off centre. Four bands
        failed for being too wordy rather than for being in the wrong place.
      */
      out.push({
        id,
        left: Math.round(text.left - shell.left),
        right: Math.round(shell.right - text.right),
        width: Math.round(shell.width),
      });
    }
    return out;
  });
}

async function openBuilderWith(page: Page, align: string) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await adminSession(page);

  const answer = await layoutWith(page, align);
  await page.route("**/api/homepage-sections", async (route) => {
    // Nothing here should ever write. If something does, fail loudly rather
    // than quietly changing the shop's live homepage.
    expect(route.request().method(), "the alignment probe tried to save").toBe("GET");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(answer),
    });
  });

  await page.goto("/admin/builders/homepage");
  await expect(page.locator("[data-section-id]").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

test("every heading moves when the shop moves it, whatever shape its row is", async ({
  page,
}) => {
  /*
    COMPARED ACROSS THE THREE SETTINGS, not judged against an absolute.

    A first draft asked each heading to be flush against an edge, and the
    price-cards band failed at `right` with 130px of air on its left and 146px
    on its right — which looks dead centre and is not. That band's link is
    pinned out of the flow, so a heading ranged right has to reserve 7rem for
    it or run underneath; in the builder's 624px preview panel the reserve is
    a fifth of the band. The heading was exactly where it should be and the
    assertion was measuring the wrong thing.

    What actually matters is that the setting MOVES the heading, and moves it
    the right way. Every reserve, padding and pill cancels out when the same
    band is measured three times.
  */
  test.setTimeout(240_000);

  const runs: Record<string, Awaited<ReturnType<typeof headings>>> = {};
  for (const align of ["left", "center", "right"]) {
    await openBuilderWith(page, align);
    runs[align] = await headings(page);
    expect(
      runs[align].length,
      `only ${runs[align].length} headings drew at ${align} — too few to mean anything`,
    ).toBeGreaterThan(5);
  }

  const wrong: string[] = [];
  for (const row of runs.left) {
    const middle = runs.center.find((r) => r.id === row.id);
    const end = runs.right.find((r) => r.id === row.id);
    if (!middle || !end) {
      wrong.push(`${row.id} did not draw at all three settings`);
      continue;
    }
    /*
      THREE PLAIN QUESTIONS, rather than a distance. A first draft asked each
      step to move the heading a quarter of its own width, and four bands
      failed for having headings too wide to travel that far inside the
      builder's 624px preview panel. How far a heading CAN move is a fact
      about the words in it; which way it moves is the setting.
    */
    if (row.left >= row.right) {
      wrong.push(
        `${row.id}: set to left, but with ${row.left}px of air on its left and ${row.right}px on its right`,
      );
    }
    if (end.right >= end.left) {
      wrong.push(
        `${row.id}: set to right, but with ${end.left}px of air on its left and ${end.right}px on its right`,
      );
    }
    // And it really travelled, rather than shifting by a padding change
    // wearing the setting's name.
    if (end.left - row.left < 40) {
      wrong.push(
        `${row.id}: left to right moved it only ${end.left - row.left}px`,
      );
    }
    // And centred means centred on the band, not on the space beside a pill.
    if (Math.abs(middle.left - middle.right) > 14) {
      wrong.push(
        `${row.id}: centred, but with ${middle.left}px of air one side and ${middle.right}px the other`,
      );
    }
  }

  expect(
    wrong,
    `${wrong.length} of ${runs.left.length} headings do not follow the setting:` +
      "\n  " + wrong.join("\n  "),
  ).toEqual([]);
});
test("and a heading nobody has positioned stays where it always was", async ({ page }) => {
  /*
    THE PROMISE THIS WHOLE FEATURE IS UNDER. Not one layout in the database
    carries this key, so the blank path is not an edge case — it is what every
    band on every live page is using. Eleven section types are drawn left and
    twelve centred, so a single shared default would quietly re-align eleven of
    them, and the diff for that is one word.

    Blank here means blank: the shop's own layout, served back untouched.
  */
  await page.setViewportSize({ width: 1440, height: 1000 });
  await adminSession(page);
  await page.goto("/admin/builders/homepage");
  await expect(page.locator("[data-section-id]").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  await page.waitForTimeout(1200);

  const seen = await headings(page);
  expect(seen.length, "too few headings drew for this to be a measurement").toBeGreaterThan(5);

  // Some left, some centred — which is the point. A page where every heading
  // agreed would mean one default had been applied to all of them.
  const centred = seen.filter((row) => Math.abs(row.left - row.right) < 12).length;
  const ranged = seen.length - centred;

  expect(centred, `every heading is centred — a shared default has been applied`)
    .toBeGreaterThan(0);
  expect(ranged, `no heading is ranged to an edge — a shared default has been applied`)
    .toBeGreaterThan(0);
});
