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
 * 1400 IS THE SHOP'S NUMBER, and it is not a Tailwind breakpoint. `xl` is
 * 1280 and `2xl` is 1536, and the line the shop drew sits between them: a
 * 1280px laptop scrolls, a 1440 or a 1536 gets the arrows. 1399 and 1400 are
 * the two widths that decide it, so both are here — and so is 1536, on the
 * other side, because an earlier cut at 1600 put it on the wrong one.
 *
 * The hero follows the same number, so the page does not grow its controls in
 * two stages, and both sets are checked here together.
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
  for (const width of [390, 768, 1280, 1536, 1399, 1400, 1920]) {
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

  /**
   * BOTH SETS, COUNTED SEPARATELY.
   *
   * The rows say "Previous"/"Next" and the hero says "Previous slide"/"Next
   * slide". Counting them together would let one set cover for the other —
   * and they are drawn by two different files that only agree on a number.
   *
   * `offsetParent === null` is the check, because `hidden` is display:none:
   * a box with no offset parent is not painted AND is out of the tab order,
   * which an `invisible` or `opacity-0` gate would not be.
   */
  const controls = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const shown = (selector: string) =>
        [...document.querySelectorAll(selector)].filter(
          (el) => (el as HTMLElement).offsetParent !== null,
        ).length;
      return {
        rows: shown(
          '[data-section-id] [aria-label="Previous"], [data-section-id] [aria-label="Next"]',
        ),
        hero: shown('[aria-label="Previous slide"], [aria-label="Next slide"]'),
        overflowing: [...document.querySelectorAll("[data-section-id] div")].filter((el) => {
          const s = getComputedStyle(el);
          if (s.overflowX !== "auto" && s.overflowX !== "scroll") return false;
          return el.scrollWidth - el.clientWidth > 1;
        }).length,
      };
    });

  for (const width of [390, 768, 1024, 1280, 1399]) {
    test(`shows no arrow at all at ${width}px`, async ({ page }) => {
      /*
        BELOW THE CUT the row is moved by scrolling it — a finger, or a
        trackpad — and the hero by its dots or a swipe. Neither draws a
        chevron, and the rows here DO overflow at these widths, so there is
        something for an arrow to have been drawn for.
      */
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/store");
      await expect(page.locator("[data-section-id]").first()).toBeVisible();
      await settle(page);

      const seen = await controls(page);
      expect(seen.rows, `${seen.rows} row arrows are drawn at ${width}px`).toBe(0);
      expect(seen.hero, `${seen.hero} hero arrows are drawn at ${width}px`).toBe(0);
    });
  }

  for (const width of [1400, 1536, 1920]) {
    test(`and both sets come back at ${width}px`, async ({ page }) => {
      /*
        THE OTHER HALF, and the half that makes the first one mean something:
        a test that only proved the arrows were absent would pass just as
        happily against arrows deleted outright.

        1536 is here on purpose. An earlier cut at 1600 left a 1920px laptop
        at the 125% scaling Windows ships by default — which reports exactly
        1536 CSS pixels — on the wrong side of the line.

        Measured on this shop: from 1024px up exactly one row overflows, by
        about 300px, so one row arrow is what a correct page shows. At rest
        the strip is at its left end, so it is the forward one.
      */
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/store");
      await expect(page.locator("[data-section-id]").first()).toBeVisible();
      await settle(page);

      const seen = await controls(page);

      // A hero with one slide has no arrows to draw, and this shop's has
      // three — but say so rather than passing quietly if that ever changes.
      const slides = await page.locator('[aria-label^="Go to slide"]').count();
      expect(slides, "this shop's hero has one slide, so it has no controls")
        .toBeGreaterThan(1);
      expect(seen.hero, `${seen.hero} hero arrows are drawn at ${width}px`).toBe(2);

      test.skip(
        seen.overflowing === 0,
        `no row on this shop's homepage overflows at ${width}px`,
      );
      expect(
        seen.rows,
        `${seen.overflowing} rows overflow at ${width}px and ${seen.rows} arrows are drawn`,
      ).toBeGreaterThan(0);
    });
  }
});
