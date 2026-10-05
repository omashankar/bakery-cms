import { expect, test } from "@playwright/test";

/**
 * THE CATEGORY BAND SLIDES UP. THE BAR WITH THE LOGO DOES NOT MOVE.
 *
 * At lg the storefront header is an 88px bar with a 46px category band under
 * it, and the whole 134px was pinned — fifteen per cent of a 900px window,
 * held over a page four and a half thousand pixels long. The band now gets out
 * of the way when the customer scrolls down and comes back when they scroll
 * up; the bar never moves, which is the half of this header a customer would
 * miss.
 *
 * ONLY A BROWSER CAN SETTLE THIS. The collapse is a pair of attributes written
 * onto the node by a scroll handler and read by Tailwind variants — there is
 * no render to inspect and no module to call. The three domain tests that pin
 * this band are all about markup this change does not move, so every one of
 * them stays green whether the behaviour works, breaks or is reverted.
 *
 * A WARM SERVER. A cold dev server compiles the route on the first request and
 * the waits below are not long enough for that; the first `goto` in each test
 * is the warm-up and the measurements come after it.
 */

/** The boxes every assertion here is about. */
async function boxes(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      /*
        display:none IS "not drawn". The band stays in the DOM on a phone, and
        getBoundingClientRect answers 0 for it, so a null check on the node
        alone reports the phone as showing a band nought pixels tall.

        On a DESKTOP the collapsed band is not display:none — it is a grid
        whose single row has gone to 0fr, which is what lets the height
        animate. There it is measured, and 0 is the collapsed answer.
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
 * event, and would let a handler that only ever compares against zero pass.
 */
async function wheel(page: import("@playwright/test").Page, by: number, settle = 500) {
  await page.mouse.wheel(0, by);
  await page.waitForTimeout(settle);
}

/**
 * Every height the band passes through, one per frame, while something moves.
 *
 * Sampled inside the page rather than by polling from the test: a round trip
 * per sample is slower than the 200ms the slide takes, so from out here the
 * band appears to teleport whether it slides or not.
 */
async function heightsDuring(
  page: import("@playwright/test").Page,
  act: () => Promise<void>,
  ms = 700,
) {
  await page.evaluate(() => {
    const band = document.querySelector("[data-nav-band]");
    const seen: number[] = [];
    (window as unknown as { __bandHeights: number[] }).__bandHeights = seen;
    const tick = () => {
      if (!band) return;
      seen.push(Math.round(band.getBoundingClientRect().height));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForTimeout(ms);
  return page.evaluate(
    () => (window as unknown as { __bandHeights: number[] }).__bandHeights ?? [],
  );
}

test.describe("the desktop band", () => {
  test("goes up on the way down and comes back on the way up, and the bar never moves", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    /*
      The pointer must not be left over the band: a hover holds it open, by
      design, so that wheeling over an open menu panel cannot delete it.
    */
    await page.mouse.move(700, 700);

    const atRest = await boxes(page);
    expect(atRest.band, "there is no nav band on this page at all").not.toBeNull();
    expect(atRest.band!.height, "the band is not the 46px this test is about").toBeGreaterThan(20);
    expect(atRest.bar!.top).toBe(0);
    const openBand = atRest.band!.height;
    const barHeight = atRest.bar!.height;
    expect(atRest.header!.height).toBe(barHeight + openBand);

    /* DOWN. The band goes; the bar stays exactly where it was. */
    await wheel(page, 600);
    const down = await boxes(page);
    expect(down.scrollY, "the page did not actually scroll").toBeGreaterThan(400);
    expect(down.band!.height, "the band still has height after scrolling down").toBe(0);
    expect(down.bar!.top, "the bar left the top of the window").toBe(0);
    expect(down.bar!.height, "the bar changed size").toBe(barHeight);
    expect(down.header!.height, "the header did not shed the band's height").toBe(barHeight);

    /* JITTER. A pixel back the other way is not a customer changing their mind. */
    await wheel(page, -1, 300);
    await wheel(page, -1, 300);
    const jitter = await boxes(page);
    expect(jitter.band!.height, "one pixel of scroll-back brought the band straight down").toBe(0);

    /* UP. A deliberate flick brings it back, without reaching the top. */
    await wheel(page, -300);
    const up = await boxes(page);
    expect(up.scrollY, "the test scrolled back to the top instead of part way").toBeGreaterThan(
      100,
    );
    expect(up.band!.height, "the band did not come back on the way up").toBe(openBand);
    expect(up.bar!.top).toBe(0);
    expect(up.header!.height).toBe(barHeight + openBand);
  });

  test("slides rather than blinking out, in both directions", async ({ page }) => {
    /**
     * THE SHOP ASKED FOR THIS SPECIFICALLY: "smoothly hona chahiye".
     *
     * The first version of this feature switched the band to `display: none`,
     * which is correct, cheap and looks like the page jumping 46px. Asserted
     * by sampling the band's height every frame and requiring it to be seen
     * PART WAY — a value that is neither its open height nor zero. A band that
     * blinks out produces only those two numbers however often it is sampled,
     * so this case cannot pass on a snap.
     */
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    await page.mouse.move(700, 700);

    const openBand = (await boxes(page)).band!.height;
    expect(openBand).toBeGreaterThan(20);

    /** A height that is on the way, rather than either end of the journey. */
    const partWay = (heights: number[]) =>
      heights.filter((h) => h > 2 && h < openBand - 2);

    const closing = await heightsDuring(page, () => page.mouse.wheel(0, 600));
    expect(closing, "the band was never sampled at its open height").toContain(openBand);
    expect(closing, "the band never reached zero").toContain(0);
    expect(
      partWay(closing).length,
      `the band blinked out instead of sliding — heights seen: ${[...new Set(closing)].join(", ")}`,
    ).toBeGreaterThan(2);

    const opening = await heightsDuring(page, () => page.mouse.wheel(0, -300));
    expect(opening, "the band never came back to its open height").toContain(openBand);
    expect(
      partWay(opening).length,
      `the band blinked back instead of sliding — heights seen: ${[...new Set(opening)].join(", ")}`,
    ).toBeGreaterThan(2);
  });

  test("is open again at the top of the page", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    await page.mouse.move(700, 700);

    const openBand = (await boxes(page)).band!.height;
    await wheel(page, 800);
    expect((await boxes(page)).band!.height).toBe(0);

    await wheel(page, -4000);
    const top = await boxes(page);
    expect(top.scrollY, "the page is not back at the top").toBe(0);
    expect(top.band!.height, "the band is missing at the top of the page").toBe(openBand);
    expect(top.bar!.top).toBe(0);
  });

  test("and the clip it slides behind is let go of again", async ({ page }) => {
    /**
     * Animating a height needs `overflow: hidden`, and this element is the one
     * the 640px mega-menu panel hangs out of — so the clip is switched on for
     * the length of the slide and off again by a timer.
     *
     * A timer that did not fire, or a `transitionend` listener that never
     * heard one (there is no transition at all under
     * `prefers-reduced-motion`), would leave every dropdown on the storefront
     * cut off at the band's bottom edge, on a page where nothing looks wrong
     * until a customer opens a menu.
     */
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");
    await page.mouse.move(700, 700);

    const clipState = () =>
      page.evaluate(() => {
        const band = document.querySelector("[data-nav-band]") as HTMLElement | null;
        return {
          animating: band?.dataset.animating ?? null,
          overflow: band ? getComputedStyle(band).overflow : null,
        };
      });

    expect((await clipState()).overflow, "the band is clipped before anything moved").toBe(
      "visible",
    );

    /*
      CLOSED, the clip stays on, and should: the row inside keeps its natural
      height and would otherwise hang out of a band that is no longer there.
      What has to have happened is that the TIMER fired — an `animating` stuck
      at "true" is the failure, because it is the flag that keeps the clip on
      through the slide back.
    */
    await wheel(page, 600, 900);
    const afterClose = await clipState();
    expect(afterClose.animating, "the band is still marked as moving").toBe("false");
    expect(afterClose.overflow, "a closed band is not clipping its own row").toBe("hidden");

    /*
      OPEN AGAIN, and this is the one that matters: with the clip left on here,
      every mega-menu panel on the storefront is cut off at the band's bottom
      edge, on a page where nothing looks wrong until a customer opens a menu.
    */
    await wheel(page, -300, 900);
    const afterOpen = await clipState();
    expect(afterOpen.animating, "the band is still marked as moving").toBe("false");
    expect(afterOpen.overflow, "the clip was never let go of — dropdowns are cut off").toBe(
      "visible",
    );
  });
});

/**
 * The band is `hidden` below lg and every rule that moves it is an `lg:` one,
 * so a phone cannot see any of this. Asserted rather than reasoned, because
 * "it only affects desktop" is exactly the claim a stray utility class breaks.
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
  expect(down.band, "a phone grew a band on scroll").toBeNull();
  expect(down.bar!.top, "the phone header stopped being pinned").toBe(0);
  expect(down.bar!.height, "the phone header changed height").toBe(phoneBar);
  expect(down.header!.height).toBe(phoneBar);
});
