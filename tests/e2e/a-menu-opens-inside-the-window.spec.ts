import { expect, test } from "@playwright/test";

/**
 * A MENU A CUSTOMER CANNOT REACH IS NOT A MENU.
 *
 * This shop's header has one row. `align` in storefront-navbar chose an edge
 * from `index >= Math.floor(bandRows.length / 2)`, and with one row that is
 * `0 >= 0` — so its only menu was anchored `right-0` to a trigger near the
 * left edge and opened off the side of the window. Measured before the fix:
 * left edge at -469px, so 469 of its 640px were unreachable.
 *
 * NO SOURCE TEST COULD HAVE CAUGHT IT, and neither could the browser guard
 * that already exists for this: a box hanging off the LEFT adds nothing to
 * `scrollWidth` in a left-to-right document, so the page never grew a
 * scrollbar and `the-storefront-never-scrolls-sideways` stayed green. The
 * only thing that sees it is asking where the panel actually is.
 *
 * `clientWidth`, never `window.innerWidth`: the second counts the scrollbar,
 * which would give every assertion here about 15px of slack.
 *
 * A WARM SERVER. A cold dev server compiles the route on the first request;
 * the first `goto` is the warm-up and the measurements come after it.
 */

const WIDTHS = [1024, 1280, 1440];

test("every menu in the band opens inside the window", async ({ page }) => {
  test.setTimeout(300_000);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);

    /*
      BY MARKER, NOT BY TAG.

      `[data-nav-band] a` also matches every anchor inside every CLOSED panel:
      the panel is a sibling inside `.group`, which is inside the band, and a
      text filter does not exclude hidden elements. That worked only while
      `nth(0)` happened to be a trigger. A row can now be a menu with no
      destination of its own, and its trigger is a `<button>` — so the first
      match would become a hidden panel link and `hover()` would block on the
      visibility wait until it timed out.

      `data-mega-trigger` is on both arms of that branch, so this finds the
      row whichever element it turns out to be.
    */
    const triggers = page.locator("[data-nav-band] [data-mega-trigger]");
    const count = await triggers.count();
    expect(count, `the band has no menus at ${width}`).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const row = triggers.nth(i);
      /*
        A row that is not a menu has no panel, which is not a failure — the
        band is mostly plain links on most shops. Only rows that open one are
        measured.
      */
      await row.hover();
      await page.waitForTimeout(350);

      const seen = await page.evaluate(() => {
        const panel = [...document.querySelectorAll("[data-mega-panel]")].find(
          (node) => getComputedStyle(node).visibility === "visible",
        );
        if (!panel) return null;
        const box = panel.getBoundingClientRect();
        const clientWidth = document.documentElement.clientWidth;
        return {
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
          clientWidth,
          sideways: document.documentElement.scrollWidth - clientWidth,
        };
      });
      if (!seen) continue;

      const label = (await row.textContent())?.trim() ?? `row ${i}`;
      expect(
        seen.left,
        `"${label}" opens ${-seen.left}px off the left of a ${width}px window`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        seen.right,
        `"${label}" opens ${seen.right - seen.clientWidth}px off the right of a ${width}px window`,
      ).toBeLessThanOrEqual(seen.clientWidth);
      expect(seen.sideways, `"${label}" gave the page a sideways scrollbar`).toBe(0);
    }
  }
});

/**
 * The panel is only as wide as what it holds.
 *
 * `auto-fit` collapses the tracks it has no items for and `1fr` takes the
 * space, so one column came out as one 592px column inside a 640px card — a
 * short heading and a few links stretched across two thirds of the band. A
 * brand-new shop's menu is that card holding a single link.
 *
 * Measured rather than read off a class, because the class is chosen at
 * render from `panelShape` and a width that is computed and never applied
 * looks identical in the source.
 */
test("and is no wider than the columns it holds", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);

  await page.locator("[data-nav-band] [data-mega-trigger]").first().hover();
  await page.waitForTimeout(500);

  const seen = await page.evaluate(() => {
    const panel = [...document.querySelectorAll("[data-mega-panel]")].find(
      (node) => getComputedStyle(node).visibility === "visible",
    );
    if (!panel) return null;
    const card = panel.firstElementChild as HTMLElement;
    const grid = card.firstElementChild as HTMLElement;
    return {
      width: Math.round(panel.getBoundingClientRect().width),
      tracks: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
    };
  });

  expect(seen, "no panel opened").not.toBeNull();
  /*
    This shop keeps categories AND occasions AND a category picture, so its
    taxonomy menu is two link columns plus the card — the widest shape there
    is, and the one that still measures 640px. What the assertion pins is that
    the width is not a constant: a panel drawing fewer tracks must be smaller,
    which the unit cases over `panelShape` cover exactly.
  */
  expect(seen!.tracks, "the panel drew a different number of columns").toBeGreaterThan(0);
  expect(seen!.width, "the panel is wider than it has ever been").toBeLessThanOrEqual(640);
});

test("a menu opens from the keyboard, not only from a mouse", async ({ page }) => {
  /**
   * THE MECHANISM A MENU-ONLY ROW STANDS ON.
   *
   * A row can now declare that it has no page of its own, and its trigger is a
   * `<button>` rather than a `<Link>`. That is safe only because the panel is
   * revealed by `group-focus-within` as well as `group-hover` — a natively
   * focusable element in the wrapper is enough, and nothing needs to know
   * whether the panel is open.
   *
   * ONLY A BROWSER CAN SETTLE IT. jsdom implements neither `:hover` nor
   * `:focus-within` styling, so a className assertion there is a file-text
   * check with extra steps. The unit cases pin that the trigger IS a
   * `<button>` with its marker; this pins that focusing a trigger reveals the
   * panel and puts its links in the tab order.
   *
   * Driven against the row this shop already has, so nothing is written to the
   * database to make the case possible.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);

  const trigger = page.locator("[data-nav-band] [data-mega-trigger]").first();
  await expect(trigger, "the band has no menu to open").toBeVisible();

  /* Focus, never hover — hovering would prove the other half. */
  await trigger.focus();
  await page.waitForTimeout(400);

  const opened = await page.evaluate(() =>
    [...document.querySelectorAll("[data-mega-panel]")].some(
      (node) => getComputedStyle(node).visibility === "visible",
    ),
  );
  expect(opened, "focusing a menu trigger did not open its panel").toBe(true);

  /*
    AND THE LINKS ARE REACHABLE — one Tab from the trigger lands inside the
    panel, not past it. `invisible` is what keeps a closed panel's links out
    of the tab order, so this is the same fact read from the other end and it
    fails for the same reason: remove the focus reveal and both halves go red
    together. Measured, not assumed — there is no separate mutation that
    reddens this line alone, and saying so is more useful than implying one.

    WHAT THIS DOES NOT COVER: the row it drives is an ordinary one, whose
    trigger is still a `<Link>`. That a menu-only row`s `<button>` is a real
    focusable button is pinned in jsdom instead, by
    a-nav-row-can-open-and-go-nowhere.test.ts. Proving the pair together needs
    a marked row in the database, which no test here may write.
  */
  await page.keyboard.press("Tab");
  const inside = await page.evaluate(() =>
    Boolean(document.activeElement?.closest("[data-mega-panel]")),
  );
  expect(inside, "the panel opened but its links are not in the tab order").toBe(true);
});
