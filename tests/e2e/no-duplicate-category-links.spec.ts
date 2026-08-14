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
});
