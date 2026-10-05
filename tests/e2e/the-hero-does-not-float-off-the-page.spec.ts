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

/**
 * ONE SLIDE FORWARD OR BACK, THE WAY A CUSTOMER DOES IT NOW.
 *
 * These tests used to press `[aria-label="Next slide"]`. The shop asked for
 * the arrows to go, so there is no such button — and three of the tests that
 * pressed it reached for it inside `page.evaluate` behind an
 * `instanceof HTMLElement` guard, which means they would have gone on PASSING
 * while clicking nothing at all. One of those is the guard for the exact
 * rewind the shop reported. A green run would have said the hero was fine.
 *
 * So the press becomes a swipe, which is not a workaround: `step` — the two
 * branches that carry the whole clone arithmetic these tests exist for — is
 * now reachable only from the swipe. Pressing a dot calls `goTo` instead and
 * takes a different door.
 *
 * It THROWS when the hero or its picture is missing, rather than returning.
 * That is the entire point of rewriting them.
 */
async function swipe(page: import("@playwright/test").Page, direction: 1 | -1) {
  await page.evaluate((forward) => {
    const hero = document.querySelector('[data-section-id^="hero"]');
    const target = hero?.querySelector("img");
    if (!(target instanceof HTMLElement)) {
      throw new Error("no hero picture to swipe — the carousel is not on the page");
    }
    const at = (x: number) =>
      new Touch({ identifier: 1, target, clientX: x, clientY: 200 });
    // Past SWIPE_THRESHOLD (48px) either way. Forward is a drag to the LEFT,
    // the same direction the row itself travels.
    const from = 400;
    const to = forward === 1 ? 200 : 600;
    target.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [at(from)],
        changedTouches: [at(from)],
      }),
    );
    target.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        changedTouches: [at(to)],
      }),
    );
  }, direction);
}

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

  /*
    MEASURED AS MOVEMENT, not as a position. The row starts on a clone of the
    last slide, so its absolute offset is one slide in already — and pinning
    the first reading to 0 broke the moment that clone was added, on a
    carousel that was working.
  */
  await swipe(page, 1);
  await page.waitForTimeout(250);
  const mid = await measure();
  const partWay = before.first! - mid.first!;

  expect(partWay, `the row moved ${Math.round(partWay)}px in a quarter second`).toBeGreaterThan(
    20,
  );
  expect(partWay).toBeLessThan(width - 20);

  await page.waitForTimeout(900);
  const after = await measure();
  expect(
    Math.abs(before.first! - after.first! - width),
    `the row moved ${Math.round(before.first! - after.first!)}px, expected ${width}`,
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

  /*
    AND NO TALLER, which is a different failure and a real one.

    The slides share one flex row, so the row is as tall as the tallest — and
    an unloaded image reports the ratio of its width/height attributes, not
    its own. A 4.8:1 banner that had not loaded claimed 633px where the loaded
    ones took 396, and the hero carried 237px of empty band under the picture
    until that slide came round. Every assertion above passed throughout.
  */
  const rowHeights = await page.evaluate(() =>
    [...document.querySelectorAll('[data-section-id^="hero"] img')].map((img) =>
      Math.round(img.getBoundingClientRect().height),
    ),
  );
  expect(
    Math.max(...rowHeights) - Math.min(...rowHeights),
    `the slides are ${rowHeights.join(", ")}px tall`,
  ).toBeLessThan(2);
});

test("the loop never runs backwards, and picks itself up again", async ({ page }) => {
  /**
   * Two things only a clock can see.
   *
   * The wrap: with a modulo the last slide returning to the first animated the
   * whole row backwards, and every still frame of that looks identical to a
   * correct slider. It has to be watched.
   *
   * And the resume: a press used to stop the autoplay for the rest of the
   * visit, which reads as a carousel that has died.
   */
  test.setTimeout(120_000);
  const width = 1440;
  const height = 900;
  await page.setViewportSize({ width, height });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const sample = () =>
    page.evaluate(() => {
      const hero = document.querySelector('[data-section-id^="hero"]');
      const boxes = [...(hero?.querySelectorAll("img") ?? [])].map((img) =>
        img.getBoundingClientRect(),
      );
      const middle = window.innerWidth / 2;
      return {
        left: boxes[0]?.left ?? null,
        /*
          IS THERE A PICTURE UNDER THE MIDDLE OF THE WINDOW?

          Where the row IS says nothing about whether anything is in it. Drop
          the clone and the last turn slides onto empty space and then jumps
          home — which satisfies every assertion about the row's position,
          and shows the customer a blank band. It survived the mutation until
          this line existed.
        */
        covered: boxes.some((box) => box.left <= middle && box.right >= middle),
      };
    });

  const rowLeft = async () => (await sample()).left;

  const slides = await page.evaluate(
    () => document.querySelectorAll('[data-section-id^="hero"] img').length,
  );
  if (slides < 3) test.skip(true, "this shop has fewer than two hero slides");

  /*
    Sampled twice a second through two full turns of the loop. Every reading
    must be at or left of the one before it until the row jumps home — a
    single sample drifting RIGHT while still animating is the backwards
    rewind, and it is the only way to catch it.
  */
  let previous = (await sample()).left!;
  let jumpsHome = 0;
  /*
    SAMPLED EVERY 150ms, not every 500ms, and the interval is the whole test.

    The autoplay only ever goes forward, so the row should only ever move LEFT
    — except for one instantaneous jump off a clone, which is a whole lap. That
    gives a rule with no middle ground: a rightward reading is either the jump
    (at least a slide's width in one sample) or a bug.

    At half-second samples an ANIMATED lap reads as a single large rightward
    delta and passes for the jump it is imitating — which is exactly what a
    snap that forgot `transition-none` does, and it survived that mutation. At
    150ms the same animation is four or five smaller rightward readings, and a
    fraction of a slide moving right is something the correct version never
    produces.
  */
  for (let i = 0; i < 140; i += 1) {
    await page.waitForTimeout(150);
    const now = await sample();

    expect(
      now.covered,
      `no picture under the middle of the window at ${(i * 0.15).toFixed(1)}s`,
    ).toBe(true);

    const moved = now.left! - previous;
    const lap = width * (slides - 2);

    if (moved > 10) {
      // Rightward at all: it has to be the jump, in one sample, about a lap.
      expect(
        moved,
        `the row moved ${Math.round(moved)}px RIGHT at ${(i * 0.15).toFixed(1)}s — the autoplay only goes forward`,
      ).toBeGreaterThanOrEqual(width - 4);
      expect(
        Math.abs(moved - lap),
        `the row jumped ${Math.round(moved)}px, which is not the ${lap}px lap`,
      ).toBeLessThan(width);
      jumpsHome += 1;
    } else {
      expect(
        Math.abs(moved),
        `the row moved ${Math.round(moved)}px between samples`,
      ).toBeLessThanOrEqual(width + 4);
    }
    previous = now.left!;
  }

  expect(jumpsHome, "the loop never came round in 22 seconds").toBeGreaterThan(0);

  /*
    And it picks itself up — pressed WITH THE MOUSE, which is the whole point.

    A real click leaves the button focused, and focus used to pause the
    autoplay for as long as it lasted: the hero had not moved fifteen seconds
    later. A programmatic `.click()` does not reproduce that, and the first
    version of this test used one — so the mutation that restores the bug
    passed it. The pointer is then moved off the hero, because hovering is a
    separate and legitimate pause.

    A DOT RATHER THAN AN ARROW, and it has to be a real button: this is about
    the focus a click leaves behind, so a swipe — which leaves none — would
    test nothing. With the arrows gone the dots are the only buttons on the
    hero, which makes them the only ones that can hold that focus.
  */
  await page.click('[aria-label="Go to slide 2"]');
  await page.mouse.move(5, height - 20);
  await page.waitForTimeout(1500);
  const afterPress = (await rowLeft())!;

  // Longer than the pause plus one turn, so a hero that has resumed has
  // demonstrably moved and one that has not, has not.
  await page.waitForTimeout(21_000);
  const later = (await rowLeft())!;

  expect(
    Math.abs(later - afterPress),
    `the row is still at ${Math.round(later)} twenty-one seconds after a press`,
  ).toBeGreaterThan(10);
});

test("a tap on a dot does not stop the hero for the rest of the visit", async ({
  browser,
}) => {
  /**
   * THE PHONE PATH, and it is the one that breaks.
   *
   * `paused` is written by hover AND by focus. With a mouse the two cancel
   * out: a click focuses the arrow and pauses it, and moving the pointer away
   * fires `mouseleave`, which unpauses it. A TAP has no pointer to move away —
   * so the focus left on the button by the tap pauses the autoplay and nothing
   * ever clears it, and the hero never moves again.
   *
   * `:focus-visible` is the distinction that fixes it: the browser sets it for
   * focus arrived at by keyboard, not for focus left behind by a tap.
   *
   * This has to be a touch context. I first wrote it with a mouse click and it
   * passed against the bug — `mouseleave` was quietly doing the work, and the
   * test proved nothing.
   */
  test.setTimeout(90_000);
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const rowLeft = () =>
    page.evaluate(() => {
      const hero = document.querySelector('[data-section-id^="hero"]');
      const img = hero?.querySelector("img");
      return img ? img.getBoundingClientRect().left : null;
    });

  const slides = await page.evaluate(
    () => document.querySelectorAll('[data-section-id^="hero"] img').length,
  );
  if (slides < 3) {
    await context.close();
    test.skip(true, "this shop has fewer than two hero slides");
    return;
  }

  /*
    This was always written against a dot, because the banner's arrows were
    hidden below sm — the band is only as tall as its artwork there. The
    arrows are gone from every width now, so the dot is not merely what a
    phone has: it is the only button on the hero at all.
  */
  await page.tap('[aria-label="Go to slide 2"]');
  await page.waitForTimeout(1500);
  const afterTap = (await rowLeft())!;

  // Longer than the pause plus one turn, so a hero that has resumed has
  // demonstrably moved and one that has not, has not.
  await page.waitForTimeout(21_000);
  const later = (await rowLeft())!;

  const moved = Math.abs(later - afterTap) > 10;
  await context.close();

  expect(
    moved,
    `the hero has not moved twenty-one seconds after one tap (still at ${Math.round(later)})`,
  ).toBe(true);
});

test("the swipe loops at both ends, one slide at a time", async ({ page }) => {
  /**
   * THE SWIPE, ALL THE WAY ROUND AND OUT THE OTHER SIDE.
   *
   * This said "the arrows" and pressed them. The arrows are gone and the test
   * is NOT: `step`, with the two branches that carry the whole clone
   * arithmetic, is exactly what a swipe calls — so deleting this along with
   * the buttons would have left that arithmetic reachable by every phone
   * customer and covered by nothing.
   *
   * Everything else here watches the autoplay, which only ever moves one way
   * and only ever wraps at the end — so this wrap was never exercised, and
   * when it still used a modulo while the autoplay used a clone, every test
   * passed. Going forward off the last slide rewound the whole row, which is
   * the thing the shop reported.
   *
   * DIRECTION IS THE DISCRIMINATOR, not distance. Across a correct wrap the
   * row ends up (count-1) slides to the right of where it started — exactly
   * where a rewind would leave it — because it slides one slide onto a clone
   * and then jumps a lap with the transition off. The two are only
   * distinguishable DURING the move: forward slides left for 700ms, a rewind
   * slides right.
   */
  test.setTimeout(120_000);
  const width = 1440;
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const read = () =>
    page.evaluate(() => {
      const hero = document.querySelector('[data-section-id^="hero"]');
      const pictures = [...(hero?.querySelectorAll("img") ?? [])];
      const dots = [...(hero?.querySelectorAll('[aria-label^="Go to slide"]') ?? [])];
      const middle = window.innerWidth / 2;
      return {
        x: pictures[0]?.getBoundingClientRect().left ?? null,
        pictures: pictures.length,
        dot: dots.findIndex((d) => d.getAttribute("aria-current") === "true"),
        covered: pictures.some((img) => {
          const box = img.getBoundingClientRect();
          return box.left <= middle && box.right >= middle;
        }),
      };
    });

  const start = await read();
  const count = start.pictures - 2;
  if (count < 2) test.skip(true, "this shop has fewer than two hero slides");

  /** One swipe, watched while it moves. */
  const drag = async (expected: -1 | 1) => {
    const way = expected === 1 ? "forward" : "back";
    const before = await read();
    await swipe(page, expected);
    await page.waitForTimeout(260);
    const during = await read();

    const travelled = during.x! - before.x!;
    const wentLeft = travelled < -10;
    const wentRight = travelled > 10;
    expect(
      expected === 1 ? wentLeft : wentRight,
      `a swipe ${way} from dot ${before.dot} moved ${Math.round(travelled)}px`,
    ).toBe(true);
    // And never more than one slide, which is what a rewind would exceed.
    expect(
      Math.abs(travelled),
      `a swipe ${way} travelled ${Math.round(travelled)}px`,
    ).toBeLessThan(width + 4);

    await page.waitForTimeout(900);
    const after = await read();
    expect(after.covered, `nothing on screen after a swipe ${way} from dot ${before.dot}`).toBe(
      true,
    );
    return after;
  };

  /*
    Round once and one past, so the wrap itself is crossed — and then back the
    other way past the start, which is the clone the autoplay never touches.
  */
  for (let i = 0; i <= count; i += 1) {
    await drag(1);
  }
  for (let i = 0; i <= count + 1; i += 1) {
    await drag(-1);
  }

  const end = await read();
  expect(end.dot, "the dots lost track of which slide is showing").toBeGreaterThanOrEqual(0);
  expect(end.covered).toBe(true);
});

test("every hero slide is fetched at once, so the row is never mismatched", async ({
  page,
}) => {
  /**
   * The slides share one flex row, so the row is as tall as the tallest — and
   * an image that has not loaded reports the ratio of its `width`/`height`
   * attributes rather than its own. Those are a 3:1 reservation, so a 4.8:1
   * banner that had not loaded claimed 633px where the loaded ones took 396,
   * and the hero carried 237px of empty band under the picture until that
   * slide happened to come round.
   *
   * WHY THIS CHECKS THE ATTRIBUTE AND NOT THE HEIGHT. A pending image reports
   * the reservation ratio whether it is eager or lazy — eager only means the
   * request has been made. So the two are indistinguishable by measurement
   * during the window that matters, and a test that holds the network back to
   * create that window makes EVERY slide pending, which is uniform and passes
   * against the bug. I wrote that version first and it did exactly that.
   *
   * What separates them is whether the browser is ever asked. Read off the
   * live DOM rather than the source, so a build that strips or rewrites the
   * attribute is still caught.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const state = await page.evaluate(() => {
    const hero = document.querySelector('[data-section-id^="hero"]');
    const pictures = [...(hero?.querySelectorAll("img") ?? [])];
    return {
      count: pictures.length,
      lazy: pictures.filter((img) => img.getAttribute("loading") === "lazy").length,
      loaded: pictures.filter((img) => img.complete && img.naturalWidth > 0).length,
      heights: pictures.map((img) => Math.round(img.getBoundingClientRect().height)),
    };
  });

  if (state.count < 2) test.skip(true, "this shop has one hero slide");

  expect(
    state.lazy,
    `${state.lazy} of ${state.count} hero pictures are lazy, so the row is as tall as whichever has not loaded`,
  ).toBe(0);

  // And the settled consequence: every slide the same height, all loaded.
  expect(state.loaded).toBe(state.count);
  expect(
    Math.max(...state.heights) - Math.min(...state.heights),
    `slides are ${state.heights.join(", ")}px tall`,
  ).toBeLessThan(2);
});

test("pressing faster than the slide can move never empties the band", async ({ page }) => {
  /**
   * The jump home takes 740ms. Pressing again inside that window used to step
   * from the clone to the slide after it, which is off the end of the track —
   * six quick presses reached -13,300px on a five-slide row and the hero went
   * blank, permanently, because nothing brings an out-of-range row back.
   *
   * Every other test here waits for each move to settle, which is precisely
   * the thing a customer does not do. This one presses at 80ms.
   */
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const covered = () =>
    page.evaluate(() => {
      const hero = document.querySelector('[data-section-id^="hero"]');
      const pictures = [...(hero?.querySelectorAll("img") ?? [])];
      const dots = [...(hero?.querySelectorAll('[aria-label^="Go to slide"]') ?? [])];
      const middle = window.innerWidth / 2;
      return {
        covered: pictures.some((img) => {
          const box = img.getBoundingClientRect();
          return box.left <= middle && box.right >= middle;
        }),
        x: Math.round(pictures[0]?.getBoundingClientRect().left ?? 0),
        dot: dots.findIndex((d) => d.getAttribute("aria-current") === "true"),
      };
    });

  const slides = await page.evaluate(
    () => document.querySelectorAll('[data-section-id^="hero"] img').length,
  );
  if (slides < 3) test.skip(true, "this shop has fewer than two hero slides");

  for (const { way, direction } of [
    { way: "forward", direction: 1 as const },
    { way: "back", direction: -1 as const },
  ]) {
    /*
      CHECKED WHILE IT IS HAPPENING, not only once it has settled.

      There is a backstop that brings an out-of-range row home, so a band
      that went blank still recovered within 740ms — and a test that only
      looked at the end passed against the very defect it is named for. What
      a customer sees is the 740ms.

      A SWIPE, AND IT THROWS IF THERE IS NOTHING TO SWIPE. This reached for
      `[aria-label="Next slide"]` inside `page.evaluate` behind an
      `instanceof HTMLElement` guard, so with the arrows gone it would have
      clicked nothing eight times and then asserted that a picture covers the
      middle of the window — true of any idle hero. It would have passed,
      green, testing nothing.
    */
    let moves = 0;
    let previous = (await covered()).dot;

    for (let i = 0; i < 8; i += 1) {
      await swipe(page, direction);
      await page.waitForTimeout(80);
      const during = await covered();
      expect(
        during.covered,
        `the band is empty mid-swipe ${i + 1} of ${way} (row at ${during.x}px)`,
      ).toBe(true);
      if (during.dot !== previous) moves += 1;
      previous = during.dot;
    }

    // …and still once everything has settled.
    await page.waitForTimeout(2500);
    const now = await covered();
    expect(
      now.covered,
      `the band is empty after eight quick swipes ${way} (row at ${now.x}px)`,
    ).toBe(true);

    /*
      AND THE SWIPES HAPPENED. This is the assertion the test was missing, and
      the arrows going is what exposed it: with the control removed the presses
      became no-ops and everything above stayed green, because "a picture
      covers the middle of the window" is true of an idle hero too. Stubbing
      the swipe out proved it — the test passed while doing nothing.

      Eight swipes at 80ms move the row eight times. The autoplay ticks every
      6s and this loop runs in under one, so anything above two changes cannot
      have come from the autoplay alone.
    */
    expect(
      moves,
      `eight swipes ${way} changed the slide ${moves} times — nothing was swiped`,
    ).toBeGreaterThan(2);
  }
});

test("and at speed the row still only ever moves forwards", async ({ page }) => {
  /**
   * The reported fault, measured rather than described: pressing Next again
   * while the row sat on the clone at the end sent it BACKWARDS across two
   * slides — -5332px to -3487px at 1440px wide — because coming home and
   * taking the next step arrived as one change and the browser animated the
   * whole lap in reverse.
   *
   * Coming home is itself a rightward move, and a legitimate one: it is a
   * whole lap, taken with the transition off, onto the same picture. What
   * separates the two is that one is instant and the other is drawn. So this
   * samples at 50ms and allows a rightward jump only if it is at least a lap
   * less one slide — an animated rewind moves a fraction of that per frame.
   */
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator('[data-section-id^="hero"]')).toBeVisible();

  const row = () =>
    page.evaluate(() => {
      const hero = document.querySelector('[data-section-id^="hero"]');
      const track = hero?.querySelector("[style*='translateX']");
      if (!(track instanceof HTMLElement)) return null;
      return {
        x: new DOMMatrixReadOnly(getComputedStyle(track).transform).m41,
        width: track.clientWidth,
        nodes: track.querySelectorAll(":scope > *").length,
      };
    });

  const first = await row();
  if (!first || first.nodes < 5) test.skip(true, "this shop has fewer than three hero slides");
  const width = first!.width;
  // The track carries a copy of a slide at each end, so the shop's own count
  // is two fewer than the number of children.
  const lap = (first!.nodes - 2) * width;

  const seen: number[] = [first!.x];
  for (let i = 0; i < 6; i += 1) {
    /*
      A SWIPE, AND IT THROWS WHEN THERE IS NOTHING TO SWIPE.

      This pressed `[aria-label="Next slide"]` from inside `page.evaluate`
      behind an `instanceof HTMLElement` guard. Once the arrows came off, the
      lookup returned null, the guard skipped, nothing was ever pressed — and
      the test went on to collect an empty `rewinds` array from two seconds of
      a barely-moving row and pass. This is the guard named for the exact
      fault the shop reported; a silent pass here is worse than no test.
    */
    await swipe(page, 1);
    for (let s = 0; s < 3; s += 1) {
      await page.waitForTimeout(50);
      const now = await row();
      if (now) seen.push(now.x);
    }
  }

  const rewinds: string[] = [];
  for (let i = 1; i < seen.length; i += 1) {
    const delta = seen[i]! - seen[i - 1]!;
    if (delta > 1 && delta < lap - width) {
      rewinds.push(`${Math.round(seen[i - 1]!)}px → ${Math.round(seen[i]!)}px`);
    }
  }

  expect(
    rewinds,
    `swiping forward ran the row backwards: ${rewinds.join(", ")}`,
  ).toEqual([]);

  /*
    AND THE ROW ACTUALLY MOVED — the assertion that was missing, and the one
    that matters most here.

    An empty `rewinds` array is what this test wants to see and also what it
    gets from a row that never moved at all. Stubbing the swipe out proved it:
    green, from two seconds of samples of a hero sitting still. The guard
    named for the fault the shop reported was the emptiest of the lot.

    Six swipes move six slides. The autoplay ticks every 6s and this loop runs
    in under a second, so two slide-widths of travel cannot be its doing.
  */
  const travelled = seen.reduce(
    (total, x, i) => (i === 0 ? 0 : total + Math.abs(x - seen[i - 1]!)),
    0,
  );
  expect(
    travelled,
    `the row travelled ${Math.round(travelled)}px across six swipes — nothing was swiped`,
  ).toBeGreaterThan(width * 2);
});
