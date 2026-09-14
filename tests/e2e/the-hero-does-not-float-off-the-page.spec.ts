import { expect, test } from "@playwright/test";

/**
 * THE TOP OF THE PAGE, MEASURED RATHER THAN READ.
 *
 * The band under the hero sat 186px below it — the hero's own floor and the
 * next section's ceiling, stacked, plus a margin the tile grid kept for a
 * heading that had been blanked. Every one of those three is a class string in
 * a different file, and every one of them looked reasonable on its own. Only
 * the sum was wrong, and nothing that reads source can see a sum.
 *
 * So this measures. It is the only guard in the repo that can tell 74px from
 * 186px, and the numbers are bounds rather than targets: the point is that the
 * hero and the row under it read as one top-of-page, not that the gap is any
 * particular figure.
 */

const WIDTHS = [
  { name: "phone", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 900 },
  { name: "laptop", width: 1440, height: 900 },
];

for (const { name, width, height } of WIDTHS) {
  test(`the hero and the row under it are one band at ${name} width`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/store");

    // The banner's own picture, the dots that belong to it, and the first tile
    // of the band under it — the three things whose spacing is the subject.
    const hero = page.locator('[data-section-id^="hero"]');
    await expect(hero).toBeVisible();

    const gap = await page.evaluate(() => {
      const heroEl = document.querySelector('[data-section-id^="hero"]');
      /*
        FROM THE PICTURE, not from the dots.

        Measuring from the dots leaves their own top margin OUTSIDE the
        number — push them 48px down the page and the distance to the tiles
        is unchanged, so the gap grows and the guard says nothing. Verified:
        that mutation survived the first version of this file.
      */
      const picture = heroEl?.querySelector("img") ?? null;
      const menu = document.querySelector('[data-section-id^="our-menu"]');
      const tile = menu?.querySelector("a") ?? null;

      const bottom = (el: Element | null) =>
        el ? el.getBoundingClientRect().bottom + window.scrollY : null;
      const top = (el: Element | null) =>
        el ? el.getBoundingClientRect().top + window.scrollY : null;

      const pictureBottom = bottom(picture);
      const tileTop = top(tile);
      return pictureBottom != null && tileTop != null
        ? Math.round(tileTop - pictureBottom)
        : null;
    });

    expect(gap, "the hero or the category strip is not on this page").not.toBeNull();
    /*
      An upper bound with room in it. 218px was the defect (32 to the dots,
      then 186 past them); 90 is where the three fixes landed at laptop width.
      Anything under 140 reads as one top-of-page; past that the strip starts
      to look like a page of its own.
    */
    expect(gap!, `${gap}px between the picture and the first tile`).toBeLessThan(140);
    // And a lower bound, because zero is its own bug: the dots would be
    // sitting on the tiles.
    expect(gap!).toBeGreaterThan(20);
  });

  test(`and the page does not scroll sideways at ${name} width`, async ({ page }) => {
    /**
     * The banner is the one band on this page that deliberately leaves the
     * content column, and the category strip negates its own gutter to reach
     * the screen edge. Both are exactly the shape of change that gives a
     * storefront a horizontal scrollbar, and neither shows up in a unit test.
     */
    await page.setViewportSize({ width, height });
    await page.goto("/store");
    await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth, `the page is ${scrollWidth - clientWidth}px wider than the window`).toBeLessThanOrEqual(
      clientWidth,
    );
  });
}

test("one slide slides into the next rather than cutting", async ({ page }) => {
  /**
   * The only way to tell a move from a cut is to look DURING it: both end
   * with one picture on screen. Sampled part-way through, a moving row is
   * somewhere strictly between the two positions and a cut never is.
   *
   * It also checks the DISTANCE, because the direction being right says
   * nothing about the amount: the first version of this moved 480px of a
   * 1440px slide and looked, in a screenshot, exactly like a slide.
   */
  const width = 1440;
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const measure = () =>
    page.evaluate(() => {
      const hero = document.querySelector('[data-section-id^="hero"]');
      const pictures = [...(hero?.querySelectorAll("img") ?? [])];
      return {
        count: pictures.length,
        first: pictures[0] ? pictures[0].getBoundingClientRect().left : null,
        widest: pictures.reduce((most, img) => Math.max(most, img.getBoundingClientRect().width), 0),
        height: hero ? hero.getBoundingClientRect().height : 0,
      };
    });

  const before = await measure();
  if (before.count < 2) test.skip(true, "this shop has one hero slide");
  expect(Math.round(before.first!)).toBe(0);

  /*
    EACH SLIDE IS THE WHOLE WIDTH, and this is a separate question from where
    the row is. Drop `shrink-0` and flex divides one width between the three,
    so all of them are on screen at a third the size — while the transform,
    which is a percentage of the track, still moves exactly the distance this
    test was checking. It survived the mutation until this line existed.
  */
  expect(
    Math.round(before.widest),
    `the widest slide is ${Math.round(before.widest)}px in a ${width}px window`,
  ).toBe(width);

  await page.click('[aria-label="Next slide"]');
  await page.waitForTimeout(250);
  const mid = await measure();

  expect(
    mid.first!,
    `the row is at ${Math.round(mid.first!)}px a quarter of a second in`,
  ).toBeLessThan(-20);
  expect(mid.first!).toBeGreaterThan(-width + 20);

  await page.waitForTimeout(900);
  const after = await measure();
  expect(
    Math.abs(after.first! + width),
    `settled at ${Math.round(after.first!)}px, expected ${-width}`,
  ).toBeLessThan(4);

  /*
    And the band does not move while it happens. Every slide is in the flow,
    so a picture of a different shape would resize the row mid-move and take
    the whole page with it.
  */
  expect(Math.abs(after.height - before.height)).toBeLessThan(2);
});

test("and only the slide on screen can be tabbed to", async ({ page }) => {
  /**
   * A banner slide is a link. Drawn all at once, the two off the side of the
   * screen are still in the document — and without `inert` a keyboard user
   * tabs through both of them before reaching the page.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const reachable = await page.evaluate(() => {
    const hero = document.querySelector('[data-section-id^="hero"]');
    const links = [...(hero?.querySelectorAll("a") ?? [])];
    return {
      total: links.length,
      free: links.filter((a) => !a.closest("[inert]")).length,
    };
  });

  if (reachable.total < 2) test.skip(true, "this shop has one hero slide");
  expect(reachable.free, `${reachable.free} of ${reachable.total} hero links are tabbable`).toBe(1);
});

test("the banner is shown whole, at whatever shape the shop uploaded", async ({ page }) => {
  /**
   * The band used to impose a ratio ladder and crop to it — and its middle rung
   * was wrong for every banner this CMS has shipped, throwing away a third of
   * the width between 640 and 1023px. The picture's painted ratio should now
   * match its own, whatever that is.
   *
   * Read off the element rather than assumed: this shop's artwork has already
   * changed shape twice, from 3:1 to 4.8:1.
   */
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/store");

  const shape = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      '[data-section-id^="hero"] img',
    );
    if (!img) return null;
    const painted = img.getBoundingClientRect();
    /*
      THE BOX AROUND IT TOO.

      The <img> keeps its own ratio whatever the band does, so comparing the
      picture with itself cannot see a band that imposes a ratio and clips to
      it — which is exactly the defect this case is named after. Verified:
      re-adding `aspect-[3/1]` to the band survived the first version of this
      file. The band's own height is the half that tells.
    */
    const band = img.closest('[class*="overflow-hidden"]');
    return {
      painted: painted.width / painted.height,
      intrinsic: img.naturalWidth / img.naturalHeight,
      paintedHeight: painted.height,
      bandHeight: band ? band.getBoundingClientRect().height : null,
    };
  });

  expect(shape, "the hero has no picture in it").not.toBeNull();
  expect(
    Math.abs(shape!.painted - shape!.intrinsic),
    `painted at ${shape!.painted.toFixed(2)}:1, uploaded at ${shape!.intrinsic.toFixed(2)}:1`,
  ).toBeLessThan(0.05);

  expect(shape!.bandHeight, "the picture has no band around it").not.toBeNull();
  expect(
    Math.round(shape!.bandHeight!),
    `the band is ${Math.round(shape!.bandHeight!)}px around a ${Math.round(shape!.paintedHeight)}px picture`,
  ).toBeGreaterThanOrEqual(Math.round(shape!.paintedHeight) - 1);
});
