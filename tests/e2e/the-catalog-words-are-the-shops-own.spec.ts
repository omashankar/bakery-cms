import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

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

test("and so does the filter a customer reads", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto("/store/collections");
  await page.waitForTimeout(3500);

  /** The filter group's own heading, whatever it currently says. */
  const headings = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter(
          (node) =>
            node.children.length === 0 &&
            /^(Occasion|Festival)$/.test((node.textContent ?? "").trim()),
        )
        .map((node) => (node.textContent ?? "").trim()),
    );

  const before = await headings();
  if (before.length === 0) {
    test.skip(true, "no product here carries an occasion, so the filter is not drawn");
    return;
  }
  expect(before, "the filter should start on the default word").toContain("Occasion");

  expect(await renameTheLists(page), "this browser holds no settings cache to overlay").toBe(true);

  expect(
    await headings(),
    "the shop renamed occasions and the storefront filter kept the old word",
  ).toContain("Festival");
});
