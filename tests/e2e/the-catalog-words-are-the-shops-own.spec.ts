import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect } from "./shop-state";

/**
 * A SHOP NAMES ITS OWN THREE LISTS, AND THE SCREENS FOLLOW.
 *
 * "Category", "Occasion" and "Collection" were hardcoded English — on the one
 * screen whose whole job is letting a shop describe its goods, while the word
 * for the goods themselves had been editable since the labels shipped. A phone
 * shop files under Brands; a florist sells for Festivals.
 *
 * NOTHING IS WRITTEN. The labels are overlaid in the browser's own settings
 * cache, which is where `useBusinessLabels` reads them, and the hook is woken
 * with the event the settings screen fires. One browser believes the shop
 * renamed its lists; the server is never told.
 *
 * NO RELOAD, for a reason worth writing down: the settings sync replaces this
 * cache from the server on every load, and this shop HAS a stored
 * `collectionsTitle`. Reloading put the server's value back over the overlay,
 * and an earlier version of this reported the label not following when it did.
 *
 * THESE TWO CASES ARE NOW THE WHOLE GUARD. The General screen used to offer
 * six boxes for these words and no longer does — the shop asked for them off,
 * and the words themselves stayed because deleting them would re-hardcode
 * "Shop by Category" into the storefront. So nothing else proves a stored
 * override still reaches a screen.
 */

const SETTINGS_KEY = "bakery-cms-settings";
const RENAMED = {
  categoryWord: "Brand",
  categoryWordPlural: "Brands",
  occasionWord: "Festival",
  occasionWordPlural: "Festivals",
  collectionWord: "Edit",
  collectionWordPlural: "Edits",
};

async function renameTheLists(page: import("@playwright/test").Page) {
  const applied = await page.evaluate(
    ([key, overrides]) => {
      const raw = localStorage.getItem(key as string);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      parsed.labelOverrides = { ...(parsed.labelOverrides ?? {}), ...(overrides as object) };
      localStorage.setItem(key as string, JSON.stringify(parsed));
      window.dispatchEvent(new Event("bakery-settings-updated"));
      return true;
    },
    [SETTINGS_KEY, RENAMED] as [string, typeof RENAMED],
  );
  await page.waitForTimeout(1500);
  return applied;
}

test("the catalog screen calls the three lists what the shop calls them", async ({ page }) => {
  test.setTimeout(300_000);
  await adminSession(page);

  await page.goto("/admin/catalog");
  await page.waitForTimeout(4500);

  const tabsBefore = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .map((b) => (b.textContent ?? "").trim())
      .filter((t) => /^(Categories|Occasions|Collections|Brands|Festivals|Edits)\s*\d*$/.test(t)),
  );
  expect(tabsBefore.length, "no catalog tabs on this screen").toBeGreaterThan(0);

  expect(await renameTheLists(page), "this browser holds no settings cache to overlay").toBe(true);

  const tabsAfter = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .map((b) => (b.textContent ?? "").trim())
      .filter(Boolean),
  );

  for (const word of ["Brands", "Festivals", "Edits"]) {
    expect(
      tabsAfter.some((t) => t.startsWith(word)),
      `the shop renamed its lists and the tabs still read ${tabsBefore.join(", ")}`,
    ).toBe(true);
  }
});

/**
 * AND SO DOES THE MENU A CUSTOMER READS — THROUGH THE SERVER.
 *
 * This case used to drive the storefront's OCCASION FILTER and had been
 * skipping itself — no product here carries an occasion, so the filter is
 * not drawn — on a shop with five occasions and 26 of its 29 products
 * carrying one. The message was never true. The filter is gone, on purpose —
 * collections-page.tsx records it: "I put the case for keeping it and they
 * said no extra filters at all; it is their shop."
 *
 * IT CANNOT USE THE BROWSER OVERLAY THE CASE ABOVE USES. The header's mega
 * menu heads its columns "Shop by {categoryWord}" and the rest from the
 * SERVER's nouns — mega-menu.tsx: "a HEADING resolved after mount would be
 * the default in the HTML and the shop's word one paint later, inside a panel
 * that is invisible until hover". Tried and measured: overlaying
 * `labelOverrides` in localStorage left the menu reading "Shop by Category".
 * And with the facet panel gone, nothing else on the storefront renders these
 * three words client-side.
 *
 * So it writes where the server reads, and puts back exactly what was there.
 * By KEY, restoring the previous value rather than deleting what matches: the
 * shop's own `labelOverrides` are in this document.
 */
test("and so does the menu a customer reads", async ({ page }) => {
  test.setTimeout(300_000);
  const db = await connect();
  const settings = db.collection("settings");

  const before = await settings.findOne({});
  expect(before, "this shop has no settings document").not.toBeNull();
  const overridesBefore = (before!.labelOverrides ?? {}) as Record<string, string>;

  /** Every heading inside the header's mega panel, hidden or not. */
  const columnHeadings = async () => {
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    return page.evaluate(() => {
      const panel = document.querySelector("[data-mega-panel]");
      if (!panel) return null;
      /* `textContent`: the panel is `invisible` until hover and a hidden
         subtree has no `innerText`. Scoped to the panel, so the page's RSC
         payload cannot answer for it. */
      return [...panel.querySelectorAll("p")].map((node) => (node.textContent ?? "").trim());
    });
  };

  try {
    const started = await columnHeadings();
    expect(started, "the header has no mega panel to read").not.toBeNull();
    /*
      A FLOOR, NOT A SKIP. The version this replaces treated a missing subject
      as a fact about the shop and excused itself. Finding no heading means
      the menu, the marker or the wording broke, and that is the news.
    */
    for (const word of ["Category", "Occasion", "Collection"]) {
      expect(
        started,
        `the menu does not head a column "Shop by ${word}" — ${JSON.stringify(started)}`,
      ).toContain(`Shop by ${word}`);
    }

    await settings.updateOne(
      { _id: before!._id },
      {
        $set: {
          labelOverrides: {
            ...overridesBefore,
            ...RENAMED,
          },
        },
      },
    );

    /*
      WHAT THIS CASE DOES NOT DISTINGUISH, said plainly.

      The menu takes `words = serverWords ?? clientWords`, so pulling the
      server prop out of the navbar still ends up right once the hook runs —
      measured: that mutation left everything below green. What the server
      path exists for is the FIRST PAINT, which mega-menu.tsx describes as
      the difference between the shop’s word in the HTML and the default
      swapped out one paint later.

      Asserting the raw HTML was tried and pulled: a bare `fetch` of /store
      came back with the pre-rename markup while the browser’s own
      navigation showed the new words, so the assertion was reading a cached
      response rather than the server’s answer. A guard that fails for a
      reason it does not name is worse than a named gap, so this is the gap:
      the words are proven to reach the menu, not proven to be in the HTML.
    */
    const renamed = await columnHeadings();
    for (const word of ["Brand", "Festival", "Edit"]) {
      expect(
        renamed,
        `the shop renamed its lists and the menu still reads ${JSON.stringify(renamed)}`,
      ).toContain(`Shop by ${word}`);
    }
  } finally {
    /* The value that was there, not a delete of what matches. */
    await settings.updateOne(
      { _id: before!._id },
      { $set: { labelOverrides: overridesBefore } },
    );
    const after = await settings.findOne({});
    expect(
      (after!.labelOverrides ?? {}) as Record<string, string>,
      "the probe left its wording behind",
    ).toEqual(overridesBefore);
  }
});
