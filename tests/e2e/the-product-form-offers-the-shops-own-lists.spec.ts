import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * THE PRODUCT FORM OFFERS THE SHOP'S CATALOGUE, NOT THE SHIPPED SEED.
 *
 * Its category, occasion and collection boxes were built by calling the
 * catalog readers straight from the JSX. Those read localStorage, and on a
 * cold browser that holds the SEED — `CatalogServerSync` replaces it with the
 * shop's real catalogue a moment after mount, and nothing here re-rendered
 * when it did. So the form spent the whole visit offering a taxonomy the shop
 * does not have.
 *
 * It went unnoticed for two of the three because the seed HAS categories and
 * occasions: the boxes looked populated and merely listed the wrong rows.
 * The seed has no collections at all, so the section built on the same read
 * simply did not appear — which is the only reason this was ever seen.
 *
 * Checked against the CATALOG SCREEN rather than against a fixed list: both
 * read the same three lists, so what this forbids is the two disagreeing,
 * whatever the shop happens to have in them.
 *
 * WHAT THIS CANNOT SEE, stated plainly: putting the render-time read back does
 * NOT make it fail. The form fetches the product and calls setForm a few
 * seconds in, and that re-render happens to re-read the catalog — by which
 * time the sync has landed. So the old code was correct by accident, on a
 * timing nobody chose, and would go wrong the day the product arrived first.
 * Holding the lists in state is what removes the accident; this test holds the
 * OUTCOME, which is that the two screens offer the same rows.
 */

async function listsOnTheCatalogScreen(page: import("@playwright/test").Page) {
  const lists: Record<string, string[]> = {};
  await page.goto("/admin/catalog");
  await page.waitForTimeout(4500);

  for (const tab of ["Categories", "Occasions", "Collections"]) {
    await page.getByRole("button", { name: new RegExp(`^${tab}`) }).first().click();
    await page.waitForTimeout(1400);
    lists[tab] = await page.evaluate(() =>
      [...document.querySelectorAll("tbody tr td:nth-child(2) p:first-child")]
        .map((node) => (node.textContent ?? "").replace(/\s*Hidden\s*$/, "").trim())
        .filter(Boolean),
    );
  }
  return lists;
}

test("the product form offers the same lists the catalog screen holds", async ({ page }) => {
  test.setTimeout(300_000);
  await adminSession(page);

  const catalog = await listsOnTheCatalogScreen(page);

  /*
    COLD CACHE, DELIBERATELY. Reading the catalog screen above hydrated the
    shop's real catalogue into localStorage, and the product form reads the
    same key — so leaving it warm made this test pass against the very code it
    was written to forbid. A customer-facing admin is opened cold every day;
    that is the state the bug lives in.
  */
  await page.evaluate(() => localStorage.clear());

  await page.goto("/admin/cakes");
  await page.waitForTimeout(4000);
  const href = await page.evaluate(
    () =>
      [...document.querySelectorAll('a[href*="/edit"]')]
        .map((a) => a.getAttribute("href"))
        .find(Boolean) ?? null,
  );
  expect(href, "this shop has no product to open").toBeTruthy();

  await page.goto(href!);
  await page.waitForTimeout(5500);

  /** The options under a labelled group on the form. */
  const optionsUnder = (heading: string) =>
    page.evaluate((text) => {
      const label = [...document.querySelectorAll("label")].find(
        (node) => (node.textContent ?? "").trim() === text,
      );
      const group = label?.parentElement;
      if (!group) return null;
      return [...group.querySelectorAll("label")]
        .map((node) => (node.textContent ?? "").trim())
        .filter(Boolean);
    }, heading);

  const occasions = await optionsUnder("Occasions");
  const collections = await optionsUnder("Collections");

  /*
    COLLECTIONS FIRST, because its absence is the shape the bug took: a shop
    with collections and a form with no section for them.
  */
  if (catalog.Collections.length > 0) {
    expect(
      collections,
      `the catalog screen holds ${catalog.Collections.join(", ")} and the product form shows no Collections section at all`,
    ).not.toBeNull();
    for (const name of catalog.Collections) {
      expect(collections, `"${name}" is not offered on the product form`).toContain(name);
    }
  }

  expect(occasions, "the product form has no Occasions group").not.toBeNull();
  for (const name of catalog.Occasions) {
    expect(
      occasions,
      `the catalog screen holds the occasion "${name}" and the product form offers ${occasions!.join(", ")}`,
    ).toContain(name);
  }

  /* And the primary category dropdown, which is a select rather than boxes. */
  const categories = await page.evaluate(() =>
    [...document.querySelectorAll("select")]
      .flatMap((select) => [...select.options].map((option) => option.textContent?.trim() ?? ""))
      .filter(Boolean),
  );
  for (const name of catalog.Categories) {
    expect(
      categories,
      `the catalog screen holds the category "${name}" and the form's dropdown does not offer it`,
    ).toContain(name);
  }
});
