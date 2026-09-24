import { expect, test } from "@playwright/test";

/**
 * AN OCCASION IS A PAGE OF ITS OWN.
 *
 * Categories, occasions and collections shared one address: a slug at
 * /store/collections/<slug> resolved against all three, and the listing there
 * OR'd a category's products with an occasion's tags. A shop with "Birthday
 * Cakes" as a category and "Birthday" as an occasion — this one has that, and
 * the same at wedding and anniversary — therefore had one page for the two.
 * Measured before the split: the category held FOUR products and its page
 * listed nineteen, under the category's name, and the occasion's own set could
 * not be shown at all. The menu made it worse by design — an occasion whose
 * slug a category already used was dropped from it, because it led to the
 * category's page.
 *
 * /store/occasions/<slug> is the second door. The old address is untouched,
 * which is half of what this checks: a shop's existing links keep working.
 *
 * WHICH OCCASIONS EXIST IS READ FROM THE FILTER PANEL, not from the menu. The
 * first version of this discovered them from the menu's own links, so pointing
 * the menu back at the old address made the whole test SKIP — a mutation that
 * removed the feature turned the guard off instead of turning it red. The
 * filter panel builds its list from the products themselves, which is a fact
 * about the shop rather than about the thing under test.
 */

/** The occasions this shop's own products are tagged with. */
async function occasionsInTheShop(page: import("@playwright/test").Page) {
  await page.goto("/store/collections");
  await page.waitForTimeout(3200);
  return page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll('[id*="occasion-"]')]
          .map((node) => {
            const label = document.querySelector(`label[for="${node.id}"]`);
            return (label?.textContent ?? "").trim();
          })
          .filter(Boolean),
      ),
    ].slice(0, 6),
  );
}

async function readPage(page: import("@playwright/test").Page, url: string) {
  await page.goto(url);
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const trail = [...document.querySelectorAll('nav[aria-label="Breadcrumb"] *')]
      .map((node) => (node.textContent ?? "").trim())
      .filter(Boolean);
    return {
      heading: trail[trail.length - 1] ?? null,
      /* The page prints its own total, which survives pagination. */
      total: Number(
        (document.body.textContent ?? "").match(/(\d+)\s+(?:results?|items?|products?)/i)?.[1] ??
          "-1",
      ),
    };
  });
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

test("the menu offers every occasion the shop tags, at the occasion's own address", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 1100 });

  const names = await occasionsInTheShop(page);
  if (names.length === 0) {
    test.skip(true, "no product in this shop carries an occasion, so there is none to offer");
    return;
  }

  await page.goto("/store");
  await page.waitForTimeout(3200);
  const linked = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/store/occasions/"]')].map(
        (a) => a.getAttribute("href")!.split("/").pop()!,
      ),
    ),
  ]);

  const missing = names.filter((name) => !linked.includes(slugOf(name)));
  expect(
    missing,
    `the shop tags products with ${names.join(", ")} and the menu links ${
      linked.join(", ") || "no occasion at all"
    } — an occasion the menu does not offer is one a customer cannot reach as a set`,
  ).toEqual([]);
});

test("and an occasion's page lists what the shop tagged for it", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 1100 });

  const names = await occasionsInTheShop(page);
  if (names.length === 0) {
    test.skip(true, "no product in this shop carries an occasion");
    return;
  }

  for (const name of names.slice(0, 4)) {
    const seen = await readPage(page, `/store/occasions/${slugOf(name)}`);
    expect(seen.heading, `/store/occasions/${slugOf(name)} drew no trail`).toBe(name);
    expect(
      seen.total,
      `/store/occasions/${slugOf(name)} lists nothing, but a product is tagged with it`,
    ).toBeGreaterThan(0);
  }
});

test("and it is a different page from the category that shares its slug", async ({ page }) => {
  /*
    COMPARED ON WHAT THEY LIST, not on what they are called. An earlier version
    compared headings, and a shop is free to call both rows the same word —
    this one calls a category "Anniversary" and an occasion "Anniversary", so
    that check passed for Birthday and Wedding and failed on the third for no
    fault of the code. What can only be true once the two are separate is that
    they list different sets: this shop's Birthday category holds four products
    and its Birthday occasion nineteen, and before the split both showed
    nineteen.
  */
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 1100 });

  const names = await occasionsInTheShop(page);
  const categorySlugs = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('nav[aria-label="Categories"] a')].map(
        (a) => a.getAttribute("href")!.split("/").pop()!,
      ),
    ),
  ]);

  const shared = names.filter((name) => categorySlugs.includes(slugOf(name)));
  if (shared.length === 0) {
    test.skip(
      true,
      `no slug here is both a category and an occasion — occasions: ${names.join(", ")}`,
    );
    return;
  }

  for (const name of shared.slice(0, 3)) {
    const slug = slugOf(name);
    const asOccasion = await readPage(page, `/store/occasions/${slug}`);
    const asCategory = await readPage(page, `/store/collections/${slug}`);

    expect(
      `${asCategory.heading}/${asCategory.total}`,
      `/store/collections/${slug} lists ${asCategory.total} as "${asCategory.heading}" and /store/occasions/${slug} lists ${asOccasion.total} as "${asOccasion.heading}" — one page is answering for both`,
    ).not.toBe(`${asOccasion.heading}/${asOccasion.total}`);

    /* And the old address still works: it did not become the occasion's. */
    expect(
      asCategory.total,
      `the category page at /store/collections/${slug} stopped listing anything`,
    ).toBeGreaterThan(0);
  }
});
