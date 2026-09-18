import { expect, test } from "@playwright/test";

/**
 * THE TWO THINGS ABOUT A SCROLLING ROW THAT ONLY A BROWSER CAN SETTLE.
 *
 * The sibling unit test reads the rules as written. It cannot check either of
 * these, because jsdom reports every width as 0 and has no scrollbars at all:
 *
 *   - whether the arrows really are absent below the cut and really do come
 *     back above it;
 *   - whether a bar is actually painted, which depends on a pseudo-element
 *     rule no source scan can resolve.
 *
 * WHY 1600 AND NOT `2xl`. A 1920px laptop at the 125% scaling Windows ships by
 * default reports exactly 1536 CSS pixels — Tailwind's `2xl` — so a cut there
 * would hand the arrows straight back to the commonest laptop there is. 1599
 * and 1600 are the two widths that matter, and they are both here.
 */

/**
 * EVERY ROW MOUNTED, MEASURED AND SETTLED.
 *
 * The arrows are client state: `canScroll` starts false, and the strip is
 * measured after hydration. The server HTML therefore has no arrows in it at
 * any width, and a test that reads the page as soon as the first section is
 * visible reads that HTML — so it sees none, and BOTH of the cases below
 * would pass for the wrong reason. The first would pass while the arrows were
 * on every screen and the second would fail on a page that was correct, which
 * is how this was found.
 *
 * The row that overflows on this shop is also below the fold, so the page is
 * walked to the bottom and back to get it mounted.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

test.describe("a row that scrolls sideways", () => {
  for (const width of [390, 768, 1280, 1536, 1599, 1600, 1920]) {
    test(`never paints a scrollbar at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/store");
      await expect(page.locator("[data-section-id]").first()).toBeVisible();

      const bars = await page.evaluate(() => {
        const out: { where: string; why: string }[] = [];
        for (const el of document.querySelectorAll("[data-section-id] div")) {
          const style = getComputedStyle(el);
          if (style.overflowX !== "auto" && style.overflowX !== "scroll") continue;
          const where = (el.className || "").toString().slice(0, 60);

          // The standard property, which is Firefox and every modern engine.
          if (style.scrollbarWidth !== "none") {
            out.push({ where, why: `scrollbar-width is ${style.scrollbarWidth}` });
            continue;
          }
          /*
            AND THE PSEUDO-ELEMENT, which is Chrome, Edge and Safari and which
            nothing that reads source can resolve. This is the half that had
            actually drifted: one row carried the standard property and not
            this one.
          */
          const bar = getComputedStyle(el, "::-webkit-scrollbar");
          if (bar.display !== "none") {
            out.push({ where, why: `::-webkit-scrollbar display is ${bar.display}` });
          }
        }
        return out;
      });

      expect(
        bars,
        `rows painting a bar at ${width}px: ${bars.map((b) => `${b.why} on ${b.where}`).join(" | ")}`,
      ).toEqual([]);
    });
  }

  test("has no previous/next arrow on a laptop, at any of its widths", async ({ page }) => {
    /*
      THE SHOP'S DECISION, MEASURED. Below the cut the row is moved by
      scrolling it — a finger, or a trackpad — and the arrows are not drawn.

      `hidden` is display:none, so this also proves they are out of the tab
      order: a zero-size box with no offsetParent cannot be reached.
    */
    for (const width of [390, 768, 1280, 1536, 1599]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/store");
      await expect(page.locator("[data-section-id]").first()).toBeVisible();
      await settle(page);

      const shown = await page.evaluate(() => {
        const arrows = [
          ...document.querySelectorAll(
            '[data-section-id] [aria-label="Previous"], [data-section-id] [aria-label="Next"]',
          ),
        ];
        return arrows.filter((a) => (a as HTMLElement).offsetParent !== null).length;
      });

      expect(shown, `${shown} arrows are drawn at ${width}px`).toBe(0);
    }
  });

  test("and gets them back on a screen wider than one", async ({ page }) => {
    /*
      THE OTHER HALF, and the half that makes the first one mean something: a
      test that only proved the arrows were absent would pass just as happily
      against arrows deleted outright.

      Measured on this shop: from 1024px up exactly one row overflows, by
      about 300px, so one arrow is what a correct page shows here. At rest the
      row is at its left end, so it is the forward one.
    */
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/store");
    await expect(page.locator("[data-section-id]").first()).toBeVisible();
    await settle(page);

    const seen = await page.evaluate(() => {
      const visible = (a: Element) => (a as HTMLElement).offsetParent !== null;
      const overflowing = [...document.querySelectorAll("[data-section-id] div")].filter((el) => {
        const s = getComputedStyle(el);
        if (s.overflowX !== "auto" && s.overflowX !== "scroll") return false;
        return el.scrollWidth - el.clientWidth > 1;
      }).length;
      const arrows = [
        ...document.querySelectorAll(
          '[data-section-id] [aria-label="Previous"], [data-section-id] [aria-label="Next"]',
        ),
      ].filter(visible).length;
      return { overflowing, arrows };
    });

    // If this shop's rows all happen to fit, there is nothing for an arrow to
    // do and the case has nothing to say — rather than passing quietly.
    test.skip(
      seen.overflowing === 0,
      "no row on this shop's homepage overflows at 1600px",
    );
    expect(
      seen.arrows,
      `${seen.overflowing} rows overflow at 1600px and ${seen.arrows} arrows are drawn`,
    ).toBeGreaterThan(0);
  });
});
