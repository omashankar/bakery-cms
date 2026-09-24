import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * WHAT THE CATALOG SCREEN ACTUALLY SENDS.
 *
 * Every catalog write is `PUT /api/catalog/<section>` with the whole section
 * as the body, so the request says everything: which list was touched and what
 * the row now holds. These read it and then ABORT it — the shop's catalog is
 * untouched whether the code is right or wrong, which is the only reason a
 * test is allowed to press Save on live data.
 *
 * The regression this file exists for was found by pressing the button rather
 * than by reading it. Giving occasions their own address made a category and
 * an occasion at one slug into two different pages — but the dialog's
 * uniqueness check still compared a new slug against all three lists, so
 * opening this shop's "Birthday Cakes" and pressing Save answered "already
 * used by Birthday" about a slug it had held all along. Three categories were
 * uneditable and nothing in the suite noticed, because nothing in the suite
 * had ever pressed Save.
 */

async function openCatalog(page: import("@playwright/test").Page) {
  const sent: { path: string; body: string }[] = [];
  await page.route("**/api/catalog/**", async (route) => {
    if (route.request().method() === "PUT") {
      sent.push({
        path: new URL(route.request().url()).pathname,
        body: route.request().postData() ?? "",
      });
      await route.abort();
      return;
    }
    await route.continue();
  });
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto("/admin/catalog");
  await page.waitForTimeout(4500);
  return sent;
}

/** Whatever the toast says, or "" — the screen's own account of the save. */
async function toastText(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-sonner-toast], [role=status], [role=alert]")]
      .map((node) => (node.textContent ?? "").trim())
      .join(" | "),
  );
}

test("a row can be saved even when another list uses its slug", async ({ page }) => {
  test.setTimeout(300_000);
  await adminSession(page);
  const sent = await openCatalog(page);

  await page.getByRole("button", { name: /^Edit$/ }).first().click();
  await page.waitForTimeout(1500);

  const before = sent.length;
  await page.locator("[role=dialog]").getByRole("button", { name: /^Save changes$/ }).click();
  await page.waitForTimeout(2000);

  const said = await toastText(page);
  expect(
    said,
    `saving an unchanged row was refused: "${said}" — a slug the row already holds is not a clash`,
  ).not.toMatch(/already used by/i);

  expect(
    sent.length,
    `pressing Save sent nothing at all; the screen said "${said}"`,
  ).toBeGreaterThan(before);
});

test("and switching it off sends that, not a deletion", async ({ page }) => {
  test.setTimeout(300_000);
  await adminSession(page);
  const sent = await openCatalog(page);

  await page.getByRole("button", { name: /^Edit$/ }).first().click();
  await page.waitForTimeout(1500);

  const toggle = page.locator("[role=dialog]").getByRole("switch").first();
  expect(
    await toggle.isVisible().catch(() => false),
    "the dialog has no switch, so a row can only be removed by deleting it",
  ).toBe(true);

  await toggle.click();
  await page.waitForTimeout(500);

  const before = sent.length;
  await page.locator("[role=dialog]").getByRole("button", { name: /^Save changes$/ }).click();
  await page.waitForTimeout(2000);

  const write = sent[before];
  expect(write, `pressing Save sent nothing; the screen said "${await toastText(page)}"`).toBeTruthy();
  expect(
    write!.body,
    `the write carries no isActive, so the switch decides nothing: ${write!.body.slice(0, 200)}`,
  ).toMatch(/"isActive":\s*false/);
});

test("and moving it sends the whole list renumbered", async ({ page }) => {
  /*
    RENUMBERED, not two values swapped. `sortOrder` is optional and most rows
    have never had one — swapping where neither exists writes 0 and 1 onto two
    rows and leaves the rest unnumbered, which the reader sorts AFTER them, so
    a row moved down would jump to the top.
  */
  test.setTimeout(300_000);
  await adminSession(page);
  const sent = await openCatalog(page);

  const rowsBefore = await page.evaluate(() =>
    [...document.querySelectorAll("tbody tr td:nth-child(2) p:first-child")]
      .map((p) => (p.textContent ?? "").trim())
      .slice(0, 3),
  );

  const down = page.getByRole("button", { name: /^Move .* down$/ }).first();
  expect(
    await down.isVisible().catch(() => false),
    "there is no way to reorder a list from this screen",
  ).toBe(true);

  const before = sent.length;
  await down.click();
  await page.waitForTimeout(2000);

  const write = sent[before];
  expect(write, "moving a row sent nothing").toBeTruthy();

  const body = JSON.parse(write!.body) as { name: string; sortOrder?: number }[];
  expect(
    body.every((row) => typeof row.sortOrder === "number"),
    `${body.filter((row) => typeof row.sortOrder !== "number").length} of ${body.length} rows went without a sortOrder`,
  ).toBe(true);

  expect(
    body.map((row) => row.sortOrder),
    "the numbers are not 0..n-1 in order",
  ).toEqual(body.map((_, index) => index));

  /* And the first row actually moved down past the second. */
  expect(
    [body[0]?.name, body[1]?.name],
    `the list came back as ${body.slice(0, 3).map((r) => r.name).join(", ")} against ${rowsBefore.join(", ")}`,
  ).toEqual([rowsBefore[1], rowsBefore[0]]);
});
