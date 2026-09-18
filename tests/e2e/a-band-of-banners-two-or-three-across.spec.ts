import { expect, test } from "@playwright/test";

/**
 * THE SIZES, MEASURED.
 *
 * The sibling unit test reads the rules; this one looks at the pixels. Two
 * claims are being made about this band and neither can be checked by reading
 * source:
 *
 *   - every card holds the band's ratio at every width, so a row never comes
 *     out as three different heights with the background showing through;
 *   - no step ever makes a card SMALLER than the one a phone gets — which the
 *     first draft did, at exactly the width the step was added for.
 *
 * The three-across shape is measured by swapping the classes in the page and
 * adding a third card, rather than by writing to the shop. Both class lists
 * are in the source, so Tailwind has generated both.
 */

const BAND = '[data-section-id="banner-grid-pairs"]';
const WIDTHS = [390, 768, 1024, 1280, 1440, 1920];

/** Walk the page so rows below the fold mount and measure. */
async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

async function cards(page: import("@playwright/test").Page, trio: boolean) {
  return page.evaluate((asThree) => {
    const grid = document.querySelector(
      '[data-section-id="banner-grid-pairs"] div.grid',
    );
    if (!grid) return null;

    if (asThree) {
      // The two shapes share their first step, so the trio is the pair plus
      // one more column and a different box.
      grid.className = `${grid.className} xl:grid-cols-3`;
      for (const kid of grid.children) {
        kid.className = kid.className.replace("aspect-[750/290]", "aspect-[493/290]");
      }
      // A third card, so a three-column row really is three.
      grid.appendChild(grid.children[0]!.cloneNode(true));
    }

    const boxes = [...grid.children].map((kid) => kid.getBoundingClientRect());
    return {
      perRow: boxes.filter((b) => Math.abs(b.top - boxes[0]!.top) < 2).length,
      width: Math.round(boxes[0]!.width),
      height: Math.round(boxes[0]!.height),
      ratio: Number((boxes[0]!.width / boxes[0]!.height).toFixed(2)),
      // Every card the same size is the whole idea of the even row.
      sizes: boxes.map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`),
    };
  }, trio);
}

for (const trio of [false, true]) {
  const shape = trio ? "three across" : "two across";
  const wanted = trio ? 493 / 290 : 750 / 290;

  test(`${shape}: every card holds its ratio, at every width`, async ({ page }) => {
    const seen: string[] = [];
    let smallest = Number.POSITIVE_INFINITY;
    let onAPhone = 0;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/store");
      await expect(page.locator(BAND)).toBeAttached();
      await settle(page);

      const row = await cards(page, trio);
      expect(row, `the band is not on the page at ${width}px`).not.toBeNull();
      seen.push(`${width}: ${row!.perRow}/row ${row!.width}x${row!.height}`);

      expect(
        Math.abs(row!.ratio - wanted),
        `${shape} at ${width}px is ${row!.ratio}, wanted ${wanted.toFixed(2)}`,
      ).toBeLessThan(0.03);

      // …and every card in the row is the same box, not just the first.
      expect(
        new Set(row!.sizes).size,
        `${shape} at ${width}px has cards of ${row!.sizes.join(", ")}`,
      ).toBe(1);

      if (width === 390) onAPhone = row!.width;
      else smallest = Math.min(smallest, row!.width);
    }

    /*
      THE STEP HAS TO EARN ITSELF. Splitting one column into two halves each
      card, so a split at the wrong width leaves a desktop visitor with a
      smaller banner than a phone gets. Measured, that is exactly what the
      first draft of this band did: 350px at 768 against the phone's 358.
    */
    expect(
      smallest,
      `the smallest card is ${smallest}px and a phone gets ${onAPhone}px — ${seen.join(" | ")}`,
    ).toBeGreaterThanOrEqual(onAPhone);
  });
}

test("the band adds no sideways scroll to the page", async ({ page }) => {
  // A row of cards that overruns its column takes the whole window with it.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/store");
    await expect(page.locator(BAND)).toBeAttached();
    await settle(page);

    const over = await page.evaluate(() => {
      const band = document.querySelector('[data-section-id="banner-grid-pairs"]');
      const limit = document.documentElement.clientWidth;
      const wide = [...(band?.querySelectorAll("*") ?? [])].filter((el) => {
        const box = el.getBoundingClientRect();
        return box.right > limit + 0.5 || box.left < -0.5;
      }).length;
      return wide;
    });

    expect(over, `${over} things in the band overrun the window at ${width}px`).toBe(0);
  }
});
