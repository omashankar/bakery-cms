import { expect, test } from "@playwright/test";

/**
 * The header's Shop menu must not render one category twice.
 *
 * The category list is admin-typed and nothing stops two rows sharing a slug —
 * this shop has two called "Seasonal". The menu keys each link by its href, so
 * a duplicate produced React's "Encountered two children with the same key"
 * warning, whose documented behaviour is that children may be "duplicated
 * and/or omitted".
 *
 * Only a browser catches this: the warning is a runtime console error, and
 * whether it fires depends on the shop's data rather than on the source.
 */
test("the shop menu links each category once, with no React key collision", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/same key|keys should be unique/i.test(text)) problems.push(text);
  });
  page.on("pageerror", (error) => problems.push(String(error)));

  await page.goto("/store");

  const shop = page.getByRole("link", { name: /^shop$/i }).first();
  if (await shop.isVisible().catch(() => false)) {
    await shop.hover();
  }

  // The warning itself is the symptom, and it is what regressed.
  expect(problems, `React complained about the category keys:\n${problems.join("\n")}`).toEqual([]);

  /**
   * And no single list repeats a link.
   *
   * Scoped per <ul>, not across the page: the desktop menu, the mobile menu and
   * the footer all legitimately link to the same categories. A duplicate KEY
   * can only happen within one mapped list, which is what this checks.
   */
  const repeated = await page.locator("ul").evaluateAll((lists) =>
    lists.flatMap((list) => {
      const hrefs = [...list.querySelectorAll('a[href^="/store/collections/"]')].map(
        (link) => link.getAttribute("href") ?? "",
      );
      return hrefs.filter((href, index) => href && hrefs.indexOf(href) !== index);
    }),
  );

  expect(repeated, `a list links the same category twice: ${repeated.join(", ")}`).toEqual([]);

  /**
   * AND NO TWO COLUMNS OF THE SAME MENU OFFER THE SAME PAGE.
   *
   * The per-<ul> check above passed over a real defect for as long as it
   * existed: the Shop menu grew a second column reading the shop's occasions,
   * and this catalogue has a category AND an occasion at `birthday`, at
   * `wedding` and at `anniversary`. Three pages appeared twice, side by side,
   * under two different names — and because the two columns are two separate
   * <ul> elements with two separate key spaces, neither React nor the loop
   * above had anything to complain about.
   *
   * A category and an occasion at one slug resolve to the SAME page. The second
   * row is not another destination; it is the same link with a different word
   * on it. So the scope that matters is the MENU, not the list.
   */
  /*
    `[data-mega-panel]`, because the class this used to hunt for has not
    existed since the panel's width gained a `min()`: `w-[640px]` is not a
    substring of `w-[min(640px,calc(100vw-2rem))]`, so this locator matched
    nothing, the `evaluateAll` below returned an empty list, and the assertion
    has been passing over an element that was never there. The count check is
    the half that makes this capable of failing at all.
  */
  expect(
    await page.locator("[data-mega-panel]").count(),
    "no menu panel on the page",
  ).toBeGreaterThan(0);
  const menu = page.locator("[data-mega-panel]").first();
  /*
    THE COLUMNS, not the picture beside them.

    The panel also carries a featured card — one of the shop's own categories
    that has a photograph — and it links where that category links, which is
    a list item away. That is what the card is FOR, and it is what every
    reference header does with its promo tiles.

    Scoping to `ul a` keeps this case on its actual subject: two COLUMNS of
    links offering one page, which is what a category and an occasion sharing
    a slug produce. Found the day the locator above started matching anything:
    with the card counted, this reported /store/collections/cream-cakes as a
    duplicate of itself.
  */
  const menuRepeats = await menu
    .locator('ul a[href^="/store/collections/"]')
    .evaluateAll((links) => {
      const hrefs = links.map((link) => link.getAttribute("href") ?? "");
      return [...new Set(hrefs.filter((href, index) => href && hrefs.indexOf(href) !== index))];
    })
    .catch(() => [] as string[]);

  expect(
    menuRepeats,
    `the Shop menu offers the same page from two columns: ${menuRepeats.join(", ")}`,
  ).toEqual([]);
});
