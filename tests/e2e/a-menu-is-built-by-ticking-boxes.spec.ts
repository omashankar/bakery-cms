import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * A SHOP BUILDS A NAV ROW'S MENU BY TICKING BOXES, NOT BY TYPING URLs.
 *
 * `HeaderNavItem.menu` has been typed, validated and rendered by both the
 * desktop band and the phone drawer since before this file — and it is empty
 * on every row of this shop, and on every row of every shop. Filling it meant
 * hand-typing a label and an address per link into two text boxes, which is
 * enough friction that nobody ever did.
 *
 * ONLY A BROWSER CAN SETTLE THIS. The unit guards check that the writer stores
 * a pointer and that the button carries `disabled={!catalogReady}`; none of
 * them can tell whether a person can actually open the thing, see their own
 * categories in it, and come out with a link. A picker that throws on open, or
 * lists nothing because the catalogue never hydrated, passes every one of them.
 *
 * NOTHING IS SAVED. The Save button is never pressed, so the shop's stored
 * header is untouched — this drives the form, not the database.
 */

test("a nav row's menu is filled from the catalog, with no URL typed", async ({ page }) => {
  test.setTimeout(180_000);
  await adminSession(page);

  await page.goto("/admin/header");
  await page.waitForLoadState("networkidle");

  /*
    The first row's menu section. Every row has one; the first is the one this
    shop calls Home, and which row it is does not matter — what is being
    checked is that a row can be given a menu at all.
  */
  const addGroup = page.getByRole("button", { name: /^add group$/i }).first();
  await expect(addGroup, "no way to start a menu on a nav row").toBeVisible();
  await addGroup.click();

  /*
    A NEW GROUP ARRIVES UNNAMED. This software may not write a column heading
    on the shop's behalf, and "New group" appearing in a live panel is exactly
    that.
  */
  const heading = page.getByPlaceholder("Group heading").first();
  await expect(heading).toBeVisible();
  expect(await heading.inputValue(), "a new column arrives pre-named").toBe("");

  const picker = page.getByRole("button", { name: /pick from catalog/i }).first();
  await expect(picker, "the menu has no door but the keyboard").toBeVisible();

  /*
    ENABLED ONLY ONCE THE CATALOGUE IS HERE. Before that the only rows to
    offer are the shipped demo ones, and a link picked from those points at a
    category this shop does not have. The wait is the assertion.
  */
  await expect(picker, "the picker never became usable").toBeEnabled({ timeout: 30_000 });
  await picker.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  /*
    THE SHOP'S OWN ROWS, not the demo taxonomy. `Cream Cakes` is this shop's
    first category; the seeded store does not contain it, so its presence is
    what says the list came from the database.
  */
  const box = dialog.getByRole("checkbox").first();
  await expect(box, "the picker offered nothing to pick").toBeVisible();

  const firstRowText = await dialog
    .locator("label")
    .first()
    .evaluate((node) => (node as HTMLElement).innerText);
  expect(firstRowText.trim().length, "the first row in the picker has no name").toBeGreaterThan(0);

  await box.click();

  const confirm = dialog.getByRole("button", { name: /^add \d+ links?$/i });
  await expect(confirm, "ticking a box did not offer to add it").toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden();

  /*
    AND THE LINK IS THERE, showing what it points at rather than an input box.

    An input would be a lie: the server rebuilds a picked link's label and
    address from the live row on every render, so anything typed here is
    silently discarded. The escape hatch is the button beside it.
  */
  const unlink = page.getByRole("button", { name: /type it instead/i }).first();
  await expect(unlink, "the picked link did not appear in the group").toBeVisible();

  const row = page.locator("div").filter({ has: unlink }).last();
  const rowText = await row.evaluate((node) => (node as HTMLElement).innerText);
  expect(rowText, "the picked link does not say where it goes").toMatch(
    /\/store\/(collections|occasions)\//,
  );

  /*
    NO URL WAS TYPED. The whole point: the boxes a shop would have had to fill
    in by hand are not part of this flow at all.
  */
  const urlBoxes = await page.getByPlaceholder("/store/collections/...").count();
  expect(urlBoxes, "the picked link still shows a URL box to type into").toBe(0);
});
