import { expect, test } from "@playwright/test";

/**
 * NO BAND HOLDS A GAP OPEN FOR A HEADING IT HAS NOT GOT.
 *
 * Every band puts a top margin on whatever follows its heading. With a heading
 * that margin collapses against the heading's own `mb-6` and the spacing is
 * right. With a BLANK heading the heading draws nothing, the margin has
 * nothing to collapse against, and the band carries a strip of air above its
 * content that is not there below it.
 *
 * The shop found it by drawing a red box round the empty strip above its
 * promises band. Measured afterwards at 1440, four bands were carrying it —
 * why-us, both promo collages and the gift tile grid — each 48px above and
 * 24px below. Four section types ship `title: ""` on purpose, so a blank
 * heading is the ordinary case rather than an edge one.
 *
 * The sibling unit test pins the rule in the source. This is the one that
 * would have caught it first: a margin beside a heading that is not there
 * looks exactly like a margin beside a heading that is, and only the rendered
 * page knows which it was.
 */

const WIDTHS = [390, 768, 1440];

for (const width of WIDTHS) {
  test(`every band has the same air above and below at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/store");
    await expect(page.locator("[data-section-id]").first()).toBeVisible();

    // Walk the page so the bands below the fold mount and measure.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);

    const lopsided = await page.evaluate(() => {
      const out: string[] = [];
      for (const band of document.querySelectorAll("[data-section-id]")) {
        const id = band.getAttribute("data-section-id") ?? "?";
        /*
          THE HERO IS EXEMPT AND SAYS SO. It runs edge to edge from the top of
          the page on purpose, so it has no top padding at all — 0 above and
          24 below is the shape it was built to have, not a gap left open.
        */
        if (id.startsWith("hero")) continue;

        const inner = band.querySelector(":scope > div");
        if (!inner) continue;
        const drawn = [...inner.children].filter(
          (kid) => kid.getBoundingClientRect().height > 0,
        );
        if (!drawn.length) continue;

        const box = band.getBoundingClientRect();
        const above = Math.round(drawn[0]!.getBoundingClientRect().top - box.top);
        const below = Math.round(
          box.bottom - drawn[drawn.length - 1]!.getBoundingClientRect().bottom,
        );
        // 4px of slack for sub-pixel layout, not for a missing heading.
        if (Math.abs(above - below) > 4) {
          out.push(`${id}: ${above}px above, ${below}px below`);
        }
      }
      return out;
    });

    expect(
      lopsided,
      `${lopsided.length} bands are lopsided at ${width}px:\n  ` + lopsided.join("\n  "),
    ).toEqual([]);
  });
}
