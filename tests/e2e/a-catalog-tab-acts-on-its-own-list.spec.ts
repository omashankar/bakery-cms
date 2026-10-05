import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * EACH TAB DELETES FROM THE LIST IT IS SHOWING.
 *
 * The Catalog screen had two tabs when its Delete button was written, so the
 * handler read `activeTab === "categories" ? deleteCategories : deleteOccasions`.
 * Collections arrived as a third tab and fell into the else: selecting a
 * collection and pressing Delete filtered the OCCASIONS list by a collection's
 * id, matched nothing, wrote the occasions back unchanged, and told the owner
 * "Deleted 0 items". `deleteCollections` had been written at the same time as
 * the tab and had never once been called.
 *
 * Nothing about that is visible in the screen: the row stays, which reads as a
 * save that has not refreshed yet. What IS visible is the address the browser
 * writes to — every catalog write is `PUT /api/catalog/<section>` — so this
 * reads the section off the request and ABORTS it. The shop's catalog is
 * untouched whether the code is right or wrong, which is the only reason a
 * test is allowed to press Delete on live data at all.
 */
test("a catalog tab deletes from its own list, not from whichever came first", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await adminSession(page);

  const wrote: string[] = [];
  await page.route("**/api/catalog/**", async (route) => {
    if (route.request().method() === "PUT") {
      wrote.push(new URL(route.request().url()).pathname);
      await route.abort();
      return;
    }
    await route.continue();
  });
  /* Deleting a category asks first; the answer never reaches the server. */
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto("/admin/catalog");
  await page.waitForTimeout(4500);

  const sent: Record<string, string> = {};
  const empty: string[] = [];

  for (const tab of ["Categories", "Occasions", "Collections"]) {
    /* The tab button carries a count badge, so its name is not just the label. */
    await page.getByRole("button", { name: new RegExp(`^${tab}`) }).first().click();
    await page.waitForTimeout(1500);

    /* Index 0 is the header's select-all; index 1 is the first row. */
    const row = page.locator('[role="checkbox"]').nth(1);
    await row.click().catch(() => {});
    await page.waitForTimeout(600);

    const selected = await page.evaluate(
      () => (document.body.textContent ?? "").match(/(\d+) selected/)?.[1] ?? null,
    );
    if (selected !== "1") {
      /*
        A shop with nothing in one of these lists cannot answer this question,
        and a silently skipped tab is how a guard stops guarding. Recorded, and
        reported below with the rest.
      */
      empty.push(`${tab} (nothing to select)`);
      continue;
    }

    const before = wrote.length;
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page.waitForTimeout(2000);
    sent[tab] = wrote.slice(before).join(" ; ") || "(nothing was sent)";

    await row.click().catch(() => {});
    await page.waitForTimeout(400);
  }

  expect(
    empty.length,
    `this shop has no rows in: ${empty.join(", ")} — the tab could not be tested`,
  ).toBe(0);

  expect(sent.Categories, "the Categories tab").toBe("/api/catalog/categories");
  expect(sent.Occasions, "the Occasions tab").toBe("/api/catalog/occasions");
  expect(
    sent.Collections,
    `the Collections tab deletes from ${sent.Collections} — a collection's id against another list matches nothing, so the row survives and the owner is told it went`,
  ).toBe("/api/catalog/collections");
});
