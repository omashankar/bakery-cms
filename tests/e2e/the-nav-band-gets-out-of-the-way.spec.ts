import { expect, test } from "@playwright/test";

/**
 * THE CATEGORY BAND GOES UP. THE BAR WITH THE LOGO DOES NOT.
 *
 * At lg the storefront header is an 88px bar with a 46px category band under
 * it, and the whole 134px was pinned — fifteen per cent of a 900px window,
 * held over a page four and a half thousand pixels long. The band now steps
 * out of the way when the customer scrolls down and comes back when they
 * scroll up; the bar never moves, which is the half of the header a customer
 * would miss.
 *
 * ONLY A BROWSER CAN SETTLE THIS. The collapse is an attribute written onto
 * the node by a scroll handler and read by a Tailwind variant — there is no
 * render to inspect and no module to call. The three domain tests that pin
 * this band are all about markup this change does not move, so every one of
 * them stays green whether the behaviour works, breaks or is reverted.
 *
 * A WARM SERVER. A cold dev server compiles the route on the first request
 * and the wait below is not long enough for that; the first `goto` in each
 * test is the warm-up, and the measurements come after it.
 */

/** The pair of boxes every assertion here is about. */
async function boxes(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      /*
        display:none IS "not drawn". The band stays in the DOM on a phone and
        getBoundingClientRect answers 0 for it, so a null check on the node
        alone reports the phone as showing a band nought pixels tall.
      */
      if (getComputedStyle(node).display === "none") return null;
      const r = node.getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height) };
    };
    return {
      header: rect("header"),
      bar: rect("header [data-header-bar]"),
      band: rect("[data-nav-band]"),
      scrollY: Math.round(window.scrollY),
    };
  });
}

/**
 * A REAL WHEEL, not `window.scrollTo`.
 *
 * The handler is written against a stream of scroll events across frames and
 * decides on direction; a single programmatic jump to a coordinate is one
 * event and would let a handler that only ever compares against zero pass.
 */
async function wheel(page: import("@playwright/test").Page, by: number) {
  await page.mouse.wheel(0, by);
  await page.waitForTimeout(400);
}

test.describe("the desktop band", () => {
  test("goes up on the way down and comes back on the way up, and the bar never moves", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    // The pointer must not be left over the band: a hover holds it open, by
    // design, so that wheeling over an open menu panel cannot delete it.
    await page.mouse.move(700, 700);

    const atRest = await boxes(page);
    expect(atRest.band, "there is no nav band on this page at all").not.toBeNull();
    expect(atRest.band!.height, "the band is not the 46px this test is about").toBeGreaterThan(20);
    expect(atRest.bar!.top).toBe(0);
    const openHeader = atRest.header!.height;
    const barHeight = atRest.bar!.height;
    expect(openHeader).toBe(barHeight + atRest.band!.height);

    /* DOWN. The band goes; the bar stays exactly where it was. */
    await wheel(page, 600);
    const down = await boxes(page);
    expect(down.scrollY, "the page did not actually scroll").toBeGreaterThan(400);
    expect(down.band, "the band is still drawn after scrolling down").toBeNull();
    expect(down.bar!.top, "the bar left the top of the window").toBe(0);
    expect(down.bar!.height, "the bar changed size").toBe(barHeight);
    expect(down.header!.height, "the header did not shed the band's height").toBe(barHeight);

    /* JITTER. A pixel back the other way is not a customer changing their mind. */
    await wheel(page, -1);
    await wheel(page, -1);
    const jitter = await boxes(page);
    expect(jitter.band, "one pixel of scroll-back brought the band straight down").toBeNull();

    /* UP. A deliberate flick brings it back, without reaching the top. */
    await wheel(page, -300);
    const up = await boxes(page);
    expect(up.scrollY, "the test scrolled back to the top instead of part way").toBeGreaterThan(
      100,
    );
    expect(up.band, "the band did not come back on the way up").not.toBeNull();
    expect(up.bar!.top).toBe(0);
    expect(up.header!.height).toBe(openHeader);
  });

  test("is open again at the top of the page", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    await page.mouse.move(700, 700);

    await wheel(page, 800);
    expect((await boxes(page)).band).toBeNull();

    await wheel(page, -4000);
    const top = await boxes(page);
    expect(top.scrollY, "the page is not back at the top").toBe(0);
    expect(top.band, "the band is missing at the top of the page").not.toBeNull();
    expect(top.bar!.top).toBe(0);
  });
});

/**
 * The band is `hidden` below lg and the collapse rule is an `lg:` one, so a
 * phone cannot see any of this. Asserted rather than reasoned, because "it
 * only affects desktop" is exactly the claim a stray utility class breaks.
 */
test("changes nothing on a phone", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/store");
  await page.waitForLoadState("networkidle");

  const atRest = await boxes(page);
  expect(atRest.band, "the band is drawn on a phone").toBeNull();
  expect(atRest.bar!.top).toBe(0);
  const phoneBar = atRest.bar!.height;

  await wheel(page, 600);
  const down = await boxes(page);
  expect(down.scrollY).toBeGreaterThan(400);
  expect(down.bar!.top, "the phone header stopped being pinned").toBe(0);
  expect(down.bar!.height, "the phone header changed height").toBe(phoneBar);
  expect(down.header!.height).toBe(phoneBar);
});
