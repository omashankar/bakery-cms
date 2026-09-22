import { expect, test } from "@playwright/test";

/**
 * THE ONE SCREEN A CUSTOMER CANNOT SCROLL PAST.
 *
 * Fitting a photograph into the printed frame is a modal: while it is open it
 * is the whole interface, and if it does not fit there is nowhere else to go.
 * A dialog that overflows a phone is not a cosmetic fault — the button that
 * finishes the job is the one that falls off the bottom.
 *
 * The arithmetic inside it — where the photograph lands, what the export
 * contains — is covered by unit tests against a recording canvas. What only a
 * browser can answer is whether this thing fits, whether the frame is the
 * largest object on it, and whether it opens at all: none of that is visible
 * in a diff, and the dialog was made half as big again in the pass that led to
 * this file.
 */

const OPENER = "Upload photo and write name";

async function aPhotoProduct(page: import("@playwright/test").Page) {
  await page.goto("/store/collections");
  await page.waitForTimeout(1800);
  const hrefs = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/store/cakes/"]')].map((a) =>
        a.getAttribute("href"),
      ),
    ),
  ]);

  /*
    Photo printing is a per-product switch, so the first product in the list is
    usually the wrong one. Walking until one offers it is honest; giving up
    after a handful keeps a shop that sells no photo products from being a slow
    failure rather than a skip.
  */
  for (const href of hrefs.slice(0, 10)) {
    await page.goto(href!);
    await page.waitForTimeout(1600);
    if (await page.getByText(OPENER).first().isVisible().catch(() => false)) return href!;
  }
  return null;
}

test("the photo editor fits, and the frame is the biggest thing on it", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const href = await aPhotoProduct(page);
  if (!href) {
    test.skip(true, "this shop sells no product that prints a photograph");
    return;
  }

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(href);
    await page.waitForTimeout(2600);

    await page.getByText(OPENER).first().click();
    await page.waitForTimeout(1400);

    const seen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      const box = dialog.getBoundingClientRect();
      const canvas = dialog.querySelector("canvas")?.getBoundingClientRect();
      const finish = [...dialog.querySelectorAll("button")].find((node) =>
        /use this photo|sending/i.test(node.textContent ?? ""),
      );
      const done = finish?.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        offLeft: Math.round(box.left),
        offRight: Math.round(box.right - window.innerWidth),
        canvas: canvas ? Math.round(canvas.width) : 0,
        /* The button that finishes the job has to be reachable, not merely present. */
        finishInside: done ? done.bottom <= box.bottom + 1 && done.width > 0 : false,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(seen, `${width}px: the editor did not open`).not.toBeNull();
    expect(seen!.offLeft, `${width}px: the editor starts at ${seen!.offLeft}`)
      .toBeGreaterThanOrEqual(0);
    expect(seen!.offRight, `${width}px: the editor runs ${seen!.offRight}px past the right edge`)
      .toBeLessThanOrEqual(0);
    expect(seen!.height, `${width}px: the editor is ${seen!.height}px tall in a 1000px window`)
      .toBeLessThanOrEqual(920);
    expect(seen!.overflow, `${width}px: the editor gave the page a sideways scrollbar`).toBe(0);
    expect(seen!.finishInside, `${width}px: "Use this photo" is off the bottom of the editor`)
      .toBe(true);

    /*
      THE FRAME IS THE SUBJECT. It was 384px inside a 768px dialog — the
      smallest thing on the screen whose entire job is judging a crop. Measured
      against the dialog rather than against a pixel count, because the dialog
      itself is a different size at each of these widths.
    */
    expect(
      seen!.canvas / seen!.width,
      `${width}px: the frame is ${seen!.canvas}px of a ${seen!.width}px dialog`,
    ).toBeGreaterThan(0.4);
  }
});

test("and its frame shows the shape before a photograph is chosen", async ({ page }) => {
  /*
    A hairline outline reads as decoration. The fill is painted on the canvas,
    so there is no element to look for — the pixels are the only evidence, and
    this samples them: the middle of an empty frame must not be the same white
    as the corner outside it.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const href = await aPhotoProduct(page);
  if (!href) {
    test.skip(true, "this shop sells no product that prints a photograph");
    return;
  }

  await page.goto(href);
  await page.waitForTimeout(2600);
  await page.getByText(OPENER).first().click();
  await page.waitForTimeout(1600);

  const shade = await page.evaluate(() => {
    const canvas = document.querySelector('[role="dialog"] canvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const read = (x: number, y: number) => {
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      return Math.round((r! + g! + b!) / 3);
    };
    return {
      middle: read(Math.round(canvas.width / 2), Math.round(canvas.height * 0.55)),
      corner: read(2, 2),
    };
  });

  expect(shade, "there is no frame canvas to read").not.toBeNull();
  expect(
    shade!.corner,
    `the corner outside the frame is ${shade!.corner}, not the white ground`,
  ).toBeGreaterThan(230);
  expect(
    shade!.middle,
    `the empty frame is ${shade!.middle} against a ground of ${shade!.corner} — the shape is invisible`,
  ).toBeLessThan(shade!.corner - 5);
});
