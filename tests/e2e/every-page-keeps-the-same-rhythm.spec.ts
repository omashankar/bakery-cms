import { expect, test } from "@playwright/test";

/**
 * ONE RHYTHM, NOT ONE PER PAGE.
 *
 * The homepage was tuned band by band until the shop stopped asking for it to
 * draw closer, and nothing behind it moved. Measured at 1440 before this: the
 * homepage's rows sat 24px apart while every other page opened with 96px of
 * white between a single line of breadcrumb and its first card — the trail
 * ended at 178 and the first product began at 475. The product page had been
 * brought down on its own, as an override on that one file, which is how a
 * house rhythm becomes a thing exactly one page remembers.
 *
 * Headings had drifted the same way: the same panel heading drew at 18px
 * semibold in the cart and the four checkout steps, 18px BOLD on Contact, 20px
 * rising to 24 on Contact and FAQ, and 16px on the collections filter panel —
 * five spellings of one thing, two of them on a single page a few hundred
 * pixels apart.
 *
 * These are COMPARISONS between pages rather than assertions about numbers, so
 * they survive the next time the shop asks for closer: what they forbid is one
 * page moving without the others.
 */

/** The pages a customer actually shops through. */
const PAGES: [string, string][] = [
  ["home", "/store"],
  ["collections", "/store/collections"],
  ["a category", "/store/collections/cakes"],
  ["wishlist", "/store/wishlist"],
  ["cart", "/store/cart"],
  ["contact", "/store/contact"],
  ["faq", "/store/faq"],
];

async function aProduct(page: import("@playwright/test").Page) {
  await page.goto("/store/collections");
  await page.waitForTimeout(1800);
  const href = await page.evaluate(
    () => document.querySelector('a[href^="/store/p/"]')?.getAttribute("href") ?? null,
  );
  return href;
}

test("every page starts right under its trail, not a screen below it", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const product = await aProduct(page);
  /*
    A DEAD SELECTOR USED TO SHORTEN THE LIST INSTEAD OF FAILING.

    `product ? [...PAGES, …] : [...PAGES]` dropped the product page and the
    case went green having never looked at it. Not hypothetical: the product
    address moved from /store/cakes/ to /store/p/, and this selector was one
    of the things that had to move with it — silently, without this line.

    This shop publishes 29 products. Finding none means the grid, the card or
    the address changed, and that is the news.
  */
  expect(product, "no product link on the shop-all page — the selector is dead").toBeTruthy();
  const all: [string, string][] = [...PAGES, ["a product", product!]];

  const tooFar: string[] = [];
  const sideways: string[] = [];

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });

    for (const [name, path] of all) {
      await page.goto(path);
      await page.waitForTimeout(2400);

      const seen = await page.evaluate(() => {
        const crumb = document.querySelector('nav[aria-label="Breadcrumb"]');
        /* The band the trail sits in, then the page's own first section. */
        const section = crumb?.closest("div")?.nextElementSibling;
        return {
          hasTrail: Boolean(crumb),
          pad: section ? Math.round(parseFloat(getComputedStyle(section).paddingTop)) : null,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });

      /* The homepage has no trail and opens on its hero; it is not this claim. */
      if (seen.hasTrail && seen.pad !== null && seen.pad > 40) {
        tooFar.push(`${name} at ${width}px: ${seen.pad}px`);
      }
      if (seen.overflow > 0) sideways.push(`${name} at ${width}px: ${seen.overflow}px`);
    }
  }

  expect(
    tooFar,
    `these pages hold a gap under the trail that the rest do not:\n  ${tooFar.join("\n  ")}`,
  ).toEqual([]);
  expect(sideways, `these pages scroll sideways:\n  ${sideways.join("\n  ")}`).toEqual([]);
});

test("and a heading means the same thing on all of them", async ({ page }) => {
  /*
    Three roles, and the claim is that there are three: the name of the page,
    the heading over a row, and the heading inside a panel. A fourth size means
    a page has invented one, which is exactly how the five spellings above got
    here — each one reasonable on the page it was written on.
  */
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const product = await aProduct(page);
  /*
    A DEAD SELECTOR USED TO SHORTEN THE LIST INSTEAD OF FAILING.

    `product ? [...PAGES, …] : [...PAGES]` dropped the product page and the
    case went green having never looked at it. Not hypothetical: the product
    address moved from /store/cakes/ to /store/p/, and this selector was one
    of the things that had to move with it — silently, without this line.

    This shop publishes 29 products. Finding none means the grid, the card or
    the address changed, and that is the news.
  */
  expect(product, "no product link on the shop-all page — the selector is dead").toBeTruthy();
  const all: [string, string][] = [...PAGES, ["a product", product!]];

  const seen = new Map<string, string[]>();
  for (const [name, path] of all) {
    await page.goto(path);
    await page.waitForTimeout(2600);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll("main h2")]
        .filter((h) => (h.textContent ?? "").trim() && h.getBoundingClientRect().width > 0)
        .map((h) => {
          const style = getComputedStyle(h);
          return {
            key: `${Math.round(parseFloat(style.fontSize))}px/${style.fontWeight}`,
            text: (h.textContent ?? "").trim().slice(0, 28),
          };
        }),
    );
    for (const row of rows) {
      const where = seen.get(row.key) ?? [];
      if (where.length < 3) where.push(`${name}: "${row.text}"`);
      seen.set(row.key, where);
    }
  }

  expect(seen.size, "no page drew a heading at all — this test read nothing").toBeGreaterThan(0);

  const spelt = [...seen].map(([key, where]) => `${key}  ← ${where.join(" | ")}`);
  expect(
    seen.size,
    `headings are spelt ${seen.size} different ways across the shop, and there are three roles:\n  ${spelt.join("\n  ")}`,
  ).toBeLessThanOrEqual(3);
});

test("and a panel heading is the same on the page beside it", async ({ page }) => {
  /*
    THE ONE THAT CATCHES THE DRIFT WHERE IT STARTS. Contact drew "Send us a
    message" at 20/24px bold and, in the same row of the same grid, "Get in
    Touch" and "Opening Hours" at 18px bold — three panels, two spellings, one
    screen. A count of distinct sizes across the whole shop would not have
    noticed, because both spellings existed elsewhere too.
  */
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const read = async (path: string) => {
    await page.goto(path);
    await page.waitForTimeout(2600);
    return page.evaluate(() =>
      [...document.querySelectorAll("main h2")]
        .filter((h) => (h.textContent ?? "").trim() && h.getBoundingClientRect().width > 0)
        /* A panel heading sits inside a box with a border of its own. */
        .filter((h) => {
          const box = h.closest("div,aside,section");
          return box ? parseFloat(getComputedStyle(box).borderTopWidth) > 0 : false;
        })
        .map((h) => {
          const style = getComputedStyle(h);
          return {
            key: `${Math.round(parseFloat(style.fontSize))}px/${style.fontWeight}`,
            text: (h.textContent ?? "").trim().slice(0, 28),
          };
        }),
    );
  };

  const panels = [...(await read("/store/contact")), ...(await read("/store/faq"))];
  expect(panels.length, "neither page drew a heading inside a panel").toBeGreaterThan(2);

  const spellings = new Set(panels.map((p) => p.key));
  expect(
    [...spellings],
    `panel headings on Contact and FAQ are spelt ${spellings.size} ways: ${panels
      .map((p) => `"${p.text}" ${p.key}`)
      .join(", ")}`,
  ).toHaveLength(1);
});
