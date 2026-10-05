import { expect, test } from "@playwright/test";

/**
 * A CUSTOMER TYPES IN THE HEADER AND FINDS WHAT THEY TYPED.
 *
 * Nothing tested this before. The header's box, the route it posts to and the
 * page that reads the query were each covered on their own, and the wiring
 * between them was covered by nothing — so the shop's own search could have
 * been broken end to end with the suite green.
 *
 * It matters more now than it did. The box used to post to a page whose whole
 * job was to read `q`; it posts to the collections page instead, and that page
 * ignored `q` entirely until this change. A form pointed at a page that drops
 * the parameter looks perfectly well and searches nothing — which is the worst
 * shape this could fail in.
 *
 * A SECOND SEARCH IS CHECKED TOO, and here is what that does and does not
 * prove. The collections page seeds its filters from a lazy initialiser, which
 * runs once — so a same-route client-side navigation from ?q=a to ?q=b would
 * not re-seed, and the second search would quietly show the first one's
 * results. The page carries an effect against exactly that.
 *
 * But the header's form is a NATIVE GET with no onSubmit, so every search is a
 * full document load and the component remounts every time. Removing that
 * effect leaves this test green — measured, not assumed. The effect is there
 * for the day somebody makes the form client-side or links to ?q= from inside
 * the app; the unit guard pins that it exists, and this checks the path a
 * customer actually walks.
 */

const BOX = 'header input[type="search"]';

async function search(page: import("@playwright/test").Page, term: string) {
  await page.fill(BOX, term);
  await page.press(BOX, "Enter");
  await page.waitForURL(/[?&]q=/, { timeout: 15_000 });
  await page.waitForTimeout(1600);

  return page.evaluate(() => {
    const line = [...document.querySelectorAll("p")]
      .map((node) => (node.textContent ?? "").trim())
      .find((text) => text.startsWith("Showing "));
    const match = line?.match(/Showing (\d+) of (\d+)/);
    return {
      url: location.pathname + location.search,
      line: line ?? "",
      total: match ? Number(match[2]) : -1,
      names: [...document.querySelectorAll('a[href^="/store/p/"]')]
        .map((card) => (card.textContent ?? "").toLowerCase())
        .filter(Boolean),
    };
  });
}

test("the header search lands on results, and a second search replaces the first", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator(BOX)).toBeVisible();

  /* ---- a term one product carries -------------------------------------- */
  const first = await search(page, "butterscotch");
  expect(first.url, "the form no longer lands on the collections page").toContain(
    "/store/collections?q=butterscotch",
  );
  expect(first.total, `no product matched "butterscotch": ${first.line}`).toBeGreaterThan(0);
  expect(
    first.names.some((name) => name.includes("butterscotch")),
    `nothing on screen mentions the term: ${first.line}`,
  ).toBe(true);
  expect(first.line, "the page does not say what was searched").toContain("butterscotch");

  /* ---- the whole catalogue, for comparison ------------------------------ */
  await page.goto("/store/collections");
  await page.waitForTimeout(1600);
  const everything = await page.evaluate(() => {
    const line = [...document.querySelectorAll("p")]
      .map((node) => (node.textContent ?? "").trim())
      .find((text) => text.startsWith("Showing "));
    return Number(line?.match(/Showing \d+ of (\d+)/)?.[1] ?? -1);
  });
  expect(everything, "the shop has too few products to tell a search from a browse")
    .toBeGreaterThan(first.total);

  /* ---- THE SECOND SEARCH ------------------------------------------------ */
  await page.goto("/store");
  const second = await search(page, "butterscotch");
  const third = await search(page, "velvet");

  expect(third.url).toContain("q=velvet");
  expect(
    third.line,
    `the second search still shows the first's: "${second.line}" then "${third.line}"`,
  ).not.toBe(second.line);
  expect(third.line, "the second search did not re-read the query").toContain("velvet");
  expect(
    third.names.some((name) => name.includes("velvet")),
    `the second search shows the first search's products: ${third.line}`,
  ).toBe(true);

  /* ---- a term nothing carries ------------------------------------------ */
  const nothing = await search(page, "zzzznothingatall");
  expect(nothing.total, `something matched a nonsense term: ${nothing.line}`).toBe(0);
});

test("and the address the search page used to live at still finds things", async ({ page }) => {
  /*
    Anything indexed or bookmarked at the old path has to keep working. Next
    forwards the query string to the destination, so the term survives the
    redirect — which is the whole reason a redirect was used rather than
    letting the URL 404 onto a header-less error page.
  */
  await page.setViewportSize({ width: 1440, height: 900 });
  const answer = await page.goto("/store/search?q=butterscotch");

  expect(answer?.status(), "the old address does not answer").toBeLessThan(400);
  await page.waitForTimeout(1600);

  expect(page.url(), "the old address does not reach the collections page").toContain(
    "/store/collections",
  );
  const line = await page.evaluate(
    () =>
      [...document.querySelectorAll("p")]
        .map((node) => (node.textContent ?? "").trim())
        .find((text) => text.startsWith("Showing ")) ?? "",
  );
  expect(line, "the term was dropped by the redirect").toContain("butterscotch");
});
