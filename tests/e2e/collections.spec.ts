import { expect, test } from "@playwright/test";

import { connect } from "./shop-state";

/**
 * The shop's OWN plural noun, read from its settings.
 *
 * Two assertions in this file were written as /no cakes found/i and
 * /no cakes in/i. The page renders the shop's configured plural, and this
 * shop's override is "products" — so one failed outright and reported that an
 * emptied page has no empty state when it has one, and the other asserted the
 * ABSENCE of a phrase that can never appear, passing whether or not the bug it
 * guards was present.
 *
 * Hardcoding a trade noun in a CMS that sells anything is the defect this whole
 * project has been removing. A test may not do it either.
 */
async function shopProductsWord(): Promise<string> {
  try {
    const db = await connect();
    const settings = await db.collection("settings").findOne({});
    const override = (
      settings as { labelOverrides?: { productWordPlural?: string } } | null
    )?.labelOverrides?.productWordPlural;
    return (override ?? "products").trim().toLowerCase() || "products";
  } catch {
    return "products";
  }
}

/**
 * The category pages, in a browser.
 *
 * This shop's three wedding cakes cost ₹12,499, ₹15,999 and ₹18,999, and the
 * price filter's ceiling was a constant 5,000 that was also its default. So
 * /store/collections/wedding matched all three products and then removed all
 * three, and the page rendered "No Cakes found" — with the Filters badge
 * reporting that no filter was active.
 *
 * No unit test would have caught it end to end: the filter function was doing
 * exactly what it was told, by a default that was wrong.
 */
test.describe("browsing a category", () => {
  test("shows the wedding cakes, which cost more than the old filter ceiling", async ({ page }) => {
    await page.goto("/store/collections/wedding");

    // The heading is the category's, so an empty grid here is a category page
    // that says it has cakes and shows none.
    await expect(page.getByRole("heading", { name: /wedding/i }).first()).toBeVisible();

    const cards = page.locator('a[href^="/store/cakes/"]');
    await expect(cards.first(), "the wedding cakes were filtered off their own page").toBeVisible();

    /*
      And they are the expensive ones — the count is the shop's own claim
      about how many it has.

      IT USED TO READ "Showing 8 of 10", and that said two things, one of them
      about pagination, which nobody asked. The bar prints the TOTAL, and the
      second number only while a filter or a search is narrowing — so a
      category with nothing filtered now reads "4 products". The assertion
      follows the wording and keeps the claim: a real, non-zero count is on
      the page.
    */
    await expect(page.getByText(/\b[1-9]\d* [a-z]+\b/i).first()).toBeVisible();
    const countLine = await page
      .getByText(/^(?:[1-9]\d* of )?[1-9]\d* [a-z]+$/i)
      .first()
      .textContent();
    expect(countLine, "the bar states no count at all").toMatch(/[1-9]\d*/);
  });

  test("does not claim a filter is active when the slider is at the top", async ({ page }) => {
    await page.goto("/store/collections");

    /*
      THE PANEL IS BEHIND A DOOR NOW, on every width.

      It used to be a 240px sidebar on a laptop and a dialog on a phone — two
      mounts of one component, which is why `idPrefix` exists. The shop asked
      for the reference's slim bar and the sidebar went, so the panel is
      reached the same way everywhere and this case has to open it.

      What is being checked has not changed: at the top of its range the
      slider must not read as a limit. "Up to Rs19,000" beside an unfiltered
      grid tells a customer they are seeing a subset when they are seeing
      everything.
    */
    /* The door first, while it is still reachable — the open dialog covers it. */
    const door = page.getByRole("button", { name: /^filters/i }).first();
    expect(
      await door.textContent(),
      "the Filters button counts a filter nobody set",
    ).not.toMatch(/\(\d+\)/);

    await door.click();
    await expect(page.getByText(/any price/i).first()).toBeVisible();
  });

  test("offers the shop's own categories, not the ones that shipped", async ({ page }) => {
    // The pills were `categories` from landing-data — the demo taxonomy. This
    // shop's catalogue has categories that list does not (Chocolate, Premium,
    // Classic), so they had no pill and could only be reached by URL.
    const db = await connect();
    const catalog = await db.collection("catalogs").findOne({});
    const own = ((catalog?.categories ?? []) as { name: string; slug: string }[]).filter(
      (item) => item.slug,
    );
    expect(own.length, "this shop has no categories to test with").toBeGreaterThan(0);

    await page.goto("/store/collections");

    // Scoped to the pill group. An earlier version counted every link on the
    // page, so unrelated links to a collection made it fail for a reason that
    // had nothing to do with the pills.
    // EXACT, because an accessible name matches on a SUBSTRING by default and
    // the header has carried a "Shop categories" band since the reference
    // header shipped — so this locator has resolved to two navigations, and the
    // test has been red on a strict-mode violation, ever since. Nothing about
    // the pills was wrong; the locator was reading the header as well.
    const pills = page.getByRole("navigation", { name: "Categories", exact: true });
    await expect(pills).toBeVisible();

    // Every category the shop has, offered. Checked by name so a rename shows.
    for (const category of own) {
      await expect(
        pills.getByRole("link", { name: category.name, exact: true }),
        `${category.name} is missing from the category pills`,
      ).toBeVisible();
    }

    // And no duplicates — the list is admin-typed and this shop has two rows
    // sharing a slug.
    const hrefs = await pills
      .locator("a")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    expect(new Set(hrefs).size, "the same category is offered twice").toBe(hrefs.length);
  });

  test("still filters when the slider is moved down", async ({ page }) => {
    const productsWord = await shopProductsWord();
    await page.goto("/store/collections/wedding");
    await expect(page.locator('a[href^="/store/cakes/"]').first()).toBeVisible();

    /*
      THROUGH THE DOOR, because the 240px sidebar this used to reach into went
      when the shop asked for the reference's slim bar. One mount now, on
      every width, which is also the end of the duplicate-id class of bug
      `idPrefix` was added for.
    */
    await page.getByRole("button", { name: /^filters/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Driven by the keyboard. `fill()` sets the DOM value without firing the
    // change React listens for, so the slider read 19,000 and this test passed
    // or failed for reasons that had nothing to do with filtering. Home takes
    // the range input to its minimum through a real input event.
    const slider = page.getByLabel(/maximum price/i).first();
    await slider.press("Home");
    await expect(slider, "the slider did not actually move").toHaveValue("0");

    // Nothing costs nothing, so this genuinely empties the page — and the page
    // must say so, rather than falling back to showing the whole catalogue.
    //
    // The SHOP's plural noun. This read /no cakes found/i, and the page has
    // rendered `No ${labels.productWordPlural.toLowerCase()} found` for as
    // long as labels have existed — so on this shop, whose override is
    // "products", the assertion failed and reported that an emptied page has
    // no empty state when it has one.
    /* Close the panel to read the page it emptied. */
    await page.getByRole("button", { name: /^apply filters$/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(page.getByText(new RegExp(`no ${productsWord} found`, "i"))).toBeVisible();
    await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible();
  });
});

test.describe("a category page", () => {
  /**
   * A category's NAME and its SLUG are edited independently, and the product
   * carries the name. This shop has "Birthday Cakes" at /birthday, "Eggless
   * Cakes" at /eggless and "Custom Cakes" at /custom.
   *
   * The filter compared the two directly — `"birthday cakes".includes(
   * "birthday")` — so every multi-word category rendered "No Cakes in … yet"
   * for products the shop had itself assigned to it. Slugifying the name does
   * not fix it either ("birthday-cakes" is still not "birthday"); only the
   * shop's own category list knows which name goes with which route.
   *
   * The pills were moved onto the real taxonomy in an earlier fix, which made
   * this MORE visible, not less: it is the untouched half of that change.
   */
  test("shows the cakes the shop put in it, for a multi-word category", async ({ page }) => {
    const productsWord = await shopProductsWord();
    const db = await connect();
    const catalog = await db.collection("catalogs").findOne({});
    const categories = ((catalog?.categories ?? []) as { name: string; slug: string }[]).filter(
      (item) => item.slug && item.name.includes(" "),
    );
    expect(
      categories.length,
      "this shop has no multi-word category to test with",
    ).toBeGreaterThan(0);

    const products = await db
      .collection("products")
      .find({ status: "published" })
      .toArray();

    // A category the shop has actually assigned products to.
    let tested = 0;
    for (const category of categories) {
      const id = (catalog?.categories as { name: string; slug: string; id: string }[]).find(
        (item) => item.slug === category.slug,
      )?.id;
      // MEMBERSHIP, like the storefront it is checking. Counting the primary
      // alone drops a category holding only secondary members out of coverage
      // entirely — silently, via the `continue` below.
      const count = products.filter((product) =>
        ((product.categoryIds as string[] | undefined) ?? [String(product.categoryId)]).includes(
          String(id),
        ),
      ).length;
      if (count === 0) continue;

      await page.goto(`/store/collections/${category.slug}`);
      await expect(
        // Was /no cakes in/i — a phrase this page cannot produce for a shop
        // that calls its goods anything else, so the guard asserted the
        // absence of something that could never appear and passed whether or
        // not the bug was present.
        page.getByText(new RegExp(`no ${productsWord} in`, "i")),
        `"${category.name}" (/${category.slug}) holds ${count} products and rendered empty`,
      ).toHaveCount(0);
      tested += 1;
    }

    expect(tested, "no multi-word category had any products to check").toBeGreaterThan(0);
  });
});
