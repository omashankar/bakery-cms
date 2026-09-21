import { expect, test } from "@playwright/test";

/**
 * THE TRAIL STAYS, THE BANNER GOES.
 *
 * Every storefront page opened with a tinted, bordered block — `bg-cream-100`,
 * a border underneath, 32 to 40px of padding — holding a breadcrumb, a 36px
 * heading and a blurb. About 150px of furniture before a customer reached
 * anything they came for, on sixteen pages, and on a phone most of the first
 * screen.
 *
 * The shop pointed at the storefront this one is drawn from and asked for the
 * same thing set plainly: the trail, small and grey, on the page rather than
 * in a box.
 *
 * WHAT THIS GUARDS IS THE HALF THAT COULD GO QUIETLY WITH IT. Removing a band
 * is visible the moment anyone looks; removing a page's only `<h1>` is not,
 * and several of these pages have no other heading. The product page is the
 * sharp case — its `<h1>` is deliberately `sr-only`, because the name is drawn
 * beside the photograph, so "the title is still on the page" cannot be checked
 * by looking. A product page with no `<h1>` is a page a search engine cannot
 * name, and nothing on screen would say so.
 *
 * Nothing guarded the band before this: the whole component was rewritten and
 * the suite stayed green, which is the reason this file exists.
 */

const PAGES = [
  ["/store/collections", "Collections"],
  ["/store/cart", "Cart"],
  ["/store/contact", "Contact"],
  ["/store/faq", "FAQ"],
  ["/store/wishlist", "Wishlist"],
  ["/store/order/track", "Track order"],
];

async function inspect(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const crumb = document.querySelector('nav[aria-label="Breadcrumb"]');
    const items = crumb ? [...crumb.querySelectorAll("li")] : [];
    const headings = [...document.querySelectorAll("h1")];

    /*
      The band is found by what it LOOKED like rather than by a class name, so
      re-creating it under a different class still fails: a full-width block
      above the page's first section, tinted differently from the page and
      closed by a border.
    */
    const banded = [...document.querySelectorAll("div")].filter((node) => {
      const box = node.getBoundingClientRect();
      if (box.width < window.innerWidth - 4 || box.height < 60 || box.top > 400) return false;
      const style = getComputedStyle(node);
      const tinted =
        style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        style.backgroundColor !== getComputedStyle(document.body).backgroundColor;
      const closed = parseFloat(style.borderBottomWidth) > 0;
      return tinted && closed && node.contains(crumb);
    });

    return {
      hasCrumb: Boolean(crumb),
      crumbLabels: items.map((li) => (li.textContent ?? "").trim()),
      crumbFontPx: items[0] ? Math.round(parseFloat(getComputedStyle(items[0]).fontSize)) : 0,
      lastIsLink: items.length > 0 && Boolean(items[items.length - 1]!.querySelector("a")),
      lastIsCurrent:
        items.length > 0 && Boolean(items[items.length - 1]!.querySelector('[aria-current="page"]')),
      firstIsLink: items.length > 0 && Boolean(items[0]!.querySelector("a")),
      headingCount: headings.length,
      headingText: (headings[0]?.textContent ?? "").trim(),
      headingPx: headings[0] ? Math.round(parseFloat(getComputedStyle(headings[0]).fontSize)) : 0,
      bannerCount: banded.length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

test("every page keeps its trail and its heading, and none of them wears a banner", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [path, name] of PAGES) {
    await page.goto(path);
    await page.waitForTimeout(1800);
    const seen = await inspect(page);

    expect(seen.hasCrumb, `${name}: there is no breadcrumb at all`).toBe(true);
    expect(seen.bannerCount, `${name}: the breadcrumb is back inside a tinted band`).toBe(0);

    /* ---- the trail says where you are ---------------------------------- */
    expect(seen.crumbLabels[0], `${name}: the trail does not start at Home`).toBe("Home");
    expect(seen.firstIsLink, `${name}: Home is not a link, so the trail goes nowhere`).toBe(true);
    expect(
      seen.crumbLabels.length,
      `${name}: the trail is only ${JSON.stringify(seen.crumbLabels)}`,
    ).toBeGreaterThan(1);
    expect(seen.lastIsLink, `${name}: the page you are on links to itself`).toBe(false);
    expect(seen.lastIsCurrent, `${name}: nothing marks which crumb is this page`).toBe(true);

    /* ---- small, which is the whole point ------------------------------- */
    expect(seen.crumbFontPx, `${name}: the trail is set at ${seen.crumbFontPx}px`)
      .toBeLessThanOrEqual(14);

    /* ---- and the page is still named ----------------------------------- */
    expect(seen.headingCount, `${name}: it has ${seen.headingCount} h1 elements`).toBe(1);
    expect(seen.headingText.length, `${name}: its heading is empty`).toBeGreaterThan(0);
    expect(seen.headingPx, `${name}: the heading is ${seen.headingPx}px, banner-sized again`)
      .toBeLessThanOrEqual(32);

    expect(seen.overflow, `${name}: the page scrolls sideways`).toBe(0);
  }
});

test("and a product page keeps the h1 it never draws", async ({ page }) => {
  /*
    THE ONE THAT CANNOT BE CHECKED BY LOOKING. The product's name is set beside
    the photograph, so printing it again above would be the same words twice —
    the heading is therefore `sr-only`. It is still the page's only `<h1>`, and
    losing it costs nothing a person can see and everything a crawler reads.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/store/collections");
  await page.waitForTimeout(1800);
  const href = await page.evaluate(
    () => document.querySelector('a[href^="/store/cakes/"]')?.getAttribute("href") ?? "",
  );
  expect(href, "this shop has no product to open").not.toBe("");

  await page.goto(href);
  await page.waitForTimeout(2000);
  const seen = await inspect(page);

  expect(seen.hasCrumb, "the product page lost its trail").toBe(true);
  expect(seen.bannerCount, "the product page wears a band again").toBe(0);
  expect(seen.crumbLabels.length, "the trail does not reach the product").toBeGreaterThan(2);

  expect(seen.headingCount, `the product page has ${seen.headingCount} h1 elements`).toBe(1);
  expect(seen.headingText.length, "the product page's h1 is empty").toBeGreaterThan(0);

  /* It is there and it is not drawn — both halves, or this passes either way. */
  const drawn = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (!h1) return null;
    const box = h1.getBoundingClientRect();
    return { w: Math.round(box.width), h: Math.round(box.height) };
  });
  expect(drawn, "there is no h1 to measure").not.toBeNull();
  expect(
    drawn!.h,
    `the product name is printed twice: the h1 is ${drawn!.w}x${drawn!.h}`,
  ).toBeLessThanOrEqual(1);

  /* …and the name a customer reads is still on the page, drawn by the column. */
  const name = href.split("/").pop()!.split("-")[0]!;
  expect(
    (await page.locator("main").innerText()).toLowerCase(),
    "the product's name is nowhere on its own page",
  ).toContain(name.toLowerCase());
});
