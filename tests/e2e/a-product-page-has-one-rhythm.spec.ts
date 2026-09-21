import { expect, test } from "@playwright/test";

/**
 * THE COLUMN A CUSTOMER BUYS FROM, MEASURED.
 *
 * The shop asked for this page to be set like the storefront it is drawn from:
 * the spacing, the type, the order of things. Most of that is judgement and
 * cannot be tested. Three parts of it are arithmetic, and those three are the
 * ones that broke silently.
 *
 * THE RHYTHM. Every block in the right-hand column is spaced by `space-y-6` on
 * their shared parent — which is `> * + *`, a top margin on each direct child.
 * Two of those children were wrapped in `<div className="contents">` so the
 * wrapper would "not affect the layout", and `display: contents` cannot take a
 * margin: the rule resolved against a box that paints nothing and the gap was
 * dropped. Measured before the fix at 1440, the Size buttons ended at 523 and
 * the "Shape" label began at 552 where every other pair is 24 apart, and
 * "Eggless" sat ten pixels under the Shape buttons — close enough to read as
 * part of them. Nothing in the markup looked wrong.
 *
 * THE TYPE. The name was set at 36px and the price at 30, so the loudest thing
 * on the page was the name of the product the customer had just clicked the
 * name of, and the number they came to find was the quieter of the two.
 *
 * THE TOP. `sectionY` is `py-16 sm:py-20 lg:py-24`, and tailwind-merge treats a
 * prefixed utility as a different group from a bare one — so an unprefixed
 * `pt-6` override left `sm:py-20` standing and a tablet kept 80px of the gap
 * that phones and desktops had lost. Checked at every width for that reason.
 */

const SLUG_FROM = "/store/collections";

async function anyProduct(page: import("@playwright/test").Page) {
  await page.goto(SLUG_FROM);
  await page.waitForTimeout(1800);
  const href = await page.evaluate(
    () => document.querySelector('a[href^="/store/cakes/"]')?.getAttribute("href") ?? "",
  );
  expect(href, "this shop has no product to open").not.toBe("");
  return href;
}

test("the buying column is spaced by one number, not by whatever each block brought", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(2500);

  const rhythm = await page.evaluate(() => {
    const column = document.querySelectorAll("main .grid > div")[1];
    if (!column) return null;

    /*
      Zero-height children are skipped rather than measured. Several blocks are
      `lg:hidden` — the phone's wishlist button, for one — and a hidden box
      reports a top equal to its neighbour's, which would read as a 0px gap and
      fail a test about spacing for a reason that has nothing to do with it.
    */
    const drawn = [...column.children]
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter((entry) => entry.box.height > 1);

    const gaps: { after: string; gap: number }[] = [];
    for (let i = 1; i < drawn.length; i += 1) {
      gaps.push({
        after: (drawn[i - 1]!.node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
        gap: Math.round(drawn[i]!.box.top - (drawn[i - 1]!.box.top + drawn[i - 1]!.box.height)),
      });
    }
    return { count: drawn.length, gaps };
  });

  expect(rhythm, "the product page has no right-hand column").not.toBeNull();
  expect(rhythm!.count, "the column has too few blocks to have a rhythm").toBeGreaterThan(4);

  /*
    Compared against EACH OTHER rather than against 24, so a change to the house
    spacing moves them all together or fails here. A stray is any gap more than
    a pixel from the most common one.
  */
  const counts = new Map<number, number>();
  for (const { gap } of rhythm!.gaps) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  const house = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];

  const strays = rhythm!.gaps.filter((entry) => Math.abs(entry.gap - house) > 1);
  expect(
    strays.map((s) => `${s.gap}px after "${s.after}"`),
    `the column is spaced at ${house}px except here`,
  ).toEqual([]);
});

test("and the price block does not read back what the ticks already show", async ({ page }) => {
  /*
    "Eggless · Heart shape" sat under the price — a readout of what the customer
    had just ticked, three inches above the ticks themselves. The shop asked for
    it gone: the controls are the record, and a line repeating them can only
    ever agree with them or be wrong.

    TICKED FIRST, AND THE TICK IS PROVEN, or this passes on a page where nothing
    was selected and the line would not have drawn anyway. The price moving is
    the proof: these options carry a surcharge, so a changed figure means the
    selection really landed.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(2500);

  const priceNow = () =>
    page.evaluate(() => {
      const column = document.querySelectorAll("main .grid > div")[1];
      const span = [...(column?.querySelectorAll("span") ?? [])].find((node) =>
        /^[₹$€£]\s?[\d,]/.test((node.textContent ?? "").trim()),
      );
      return (span?.textContent ?? "").trim();
    });

  const before = await priceNow();
  const toggles = page.locator('main [role="checkbox"]');
  const count = await toggles.count();
  if (count === 0) {
    test.skip(true, "this product offers no tickable option to select");
    return;
  }

  for (let index = 0; index < count; index += 1) {
    await toggles.nth(index).click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const ticked = await page.evaluate(
    () =>
      [...document.querySelectorAll('main [role="checkbox"]')].filter(
        (node) => node.getAttribute("data-state") === "checked" || node.getAttribute("aria-checked") === "true",
      ).length,
  );
  if (ticked === 0) {
    test.skip(true, "no option could be ticked, so there is nothing to read back");
    return;
  }

  expect(await priceNow(), "ticking an option did not move the price").not.toBe(before);

  const block = await page.evaluate(() => {
    const column = document.querySelectorAll("main .grid > div")[1];
    return (column?.children[1]?.textContent ?? "").replace(/\s+/g, " ").trim();
  });

  /*
    The shape rather than one phrase: any "A · B" list of the option labels is
    the same readout however it is worded.
  */
  expect(block, `the price block reads back the selection: "${block}"`).not.toMatch(
    /[A-Za-z]\s·\s[A-Za-z]/,
  );
});

test("and the price is the largest figure on it, not the name", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(2500);

  const type = await page.evaluate(() => {
    const column = document.querySelectorAll("main .grid > div")[1];
    const name = column?.querySelector("h2");
    /* The price is the first thing in the column that starts with a currency. */
    const price = [...(column?.querySelectorAll("span") ?? [])].find((node) =>
      /^[₹$€£]\s?[\d,]/.test((node.textContent ?? "").trim()),
    );
    const px = (el: Element | null | undefined) =>
      el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0;
    return { name: px(name), price: px(price), priceText: (price?.textContent ?? "").trim() };
  });

  expect(type.name, "the product name is not drawn").toBeGreaterThan(0);
  expect(type.price, `no price was found in the column`).toBeGreaterThan(0);
  expect(
    type.price,
    `the name is ${type.name}px and the price ${type.priceText} is ${type.price}px`,
  ).toBeGreaterThan(type.name);
});

test("and the page starts right under its trail at every width", async ({ page }) => {
  test.setTimeout(240_000);
  const href = await (async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    return anyProduct(page);
  })();

  for (const width of [375, 640, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(href);
    await page.waitForTimeout(1600);

    const seen = await page.evaluate(() => {
      const crumb = document.querySelector('nav[aria-label="Breadcrumb"]');
      const section = crumb?.closest("div")?.nextElementSibling;
      return {
        pad: section ? Math.round(parseFloat(getComputedStyle(section).paddingTop)) : -1,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(seen.pad, `${width}px: there is no section under the trail`).toBeGreaterThan(-1);
    expect(
      seen.pad,
      `${width}px: ${seen.pad}px of nothing between the trail and the photograph`,
    ).toBeLessThanOrEqual(40);
    expect(seen.overflow, `${width}px: the product page scrolls sideways`).toBe(0);
  }
});

test("and the heart shares the row with Add to Cart on a desktop", async ({ page }) => {
  /*
    It was a labelled "Wishlist" pill pushed to the right-hand edge three rows
    above — the smallest control in the column, in the emptiest part of it,
    above the largest one. A phone keeps that button, because its Add to Cart
    lives in the fixed bar at the foot of the screen and there is no row to
    join; so both cases are checked, or moving it would quietly leave a phone
    with no way to save anything.
  */
  test.setTimeout(180_000);
  const href = await (async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    return anyProduct(page);
  })();

  await page.goto(href);
  await page.waitForTimeout(2500);

  const desktop = await page.evaluate(() => {
    /*
      SCOPED TO THE BUYING GRID, and that is not tidiness. Every card in the
      rails further down this page carries its own "Add to wishlist" heart, so
      a document-wide search finds one whatever happens up here — the first
      version of this test passed with the product's own button deleted,
      measured, because it was reading a related product's.
    */
    const grid = document.querySelectorAll("main .grid")[0];
    if (!grid) return { add: false, heart: false, sameRow: false };
    const add = [...grid.querySelectorAll("button")].find((node) =>
      /add to cart|update cart|out of stock/i.test(node.textContent ?? ""),
    );
    const heart = [...grid.querySelectorAll("button")].find((node) =>
      /wishlist/i.test(node.getAttribute("aria-label") ?? ""),
    );
    if (!add || !heart) return { add: Boolean(add), heart: Boolean(heart), sameRow: false };
    const a = add.getBoundingClientRect();
    const h = heart.getBoundingClientRect();
    return {
      add: true,
      heart: h.height > 1,
      sameRow: Math.abs(a.top - h.top) <= 2 && h.right <= a.left + 2,
    };
  });

  expect(desktop.add, "there is no Add to Cart button at all").toBe(true);
  expect(desktop.heart, "the desktop has no way to save a product").toBe(true);
  expect(desktop.sameRow, "the heart is not on the Add to Cart row").toBe(true);

  /* ---- and a phone still has one, wherever it sits ---------------------- */
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(href);
  await page.waitForTimeout(2000);

  const phone = await page.evaluate(() => {
    const grid = document.querySelectorAll("main .grid")[0];
    if (!grid) return false;
    return [...grid.querySelectorAll("button")].some((node) => {
      const named =
        /wishlist/i.test(node.textContent ?? "") ||
        /wishlist/i.test(node.getAttribute("aria-label") ?? "");
      return named && node.getBoundingClientRect().height > 1;
    });
  });
  expect(phone, "a phone lost its way to save a product").toBe(true);
});
