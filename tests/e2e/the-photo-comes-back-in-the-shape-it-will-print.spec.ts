import { expect, test } from "@playwright/test";

/**
 * THE PHOTOGRAPH IS SHOWN BACK IN THE SHAPE IT WILL BE PRINTED.
 *
 * A customer spends a minute deciding which corners of their photograph are
 * expendable, and then every screen that confirms the choice drew it in a
 * `rounded-full` box, because a circle costs nothing. On a heart that cuts the
 * lobes off; on a mug wrap — 7:3 — a square box with `object-cover` keeps three
 * sevenths of the picture and throws the rest away.
 *
 * The check is a COMPARISON rather than a description: the editor's canvas is
 * painted by `paintPhotoFrame`, the thumbnail is clipped by `framePathData`,
 * and this rasterises the clip path and lays it over the canvas. Two drawings
 * of the same frame that disagree is exactly the failure, and it is the one a
 * test that merely asked "is it clipped?" would pass straight through — the
 * cart WAS clipping, to a circle, because the shape never reached it.
 *
 * AND IT INSISTS ON AN UNROUND FRAME. Written against the first photo product
 * in the shop, this test passed every mutation that mattered: that product
 * prints in a circle, so "fell back to round" and "is the right shape" are the
 * same picture and nothing could tell them apart. It now walks until it finds a
 * product whose frame is NOT a circle, and skips loudly rather than quietly
 * proving nothing.
 */

const OPENER = "Upload photo and write name";
const CART_KEY = "bakery-cms-cart";

/** A photograph the shop already hosts, so nothing is uploaded to be swept up. */
const PHOTO =
  "https://res.cloudinary.com/w7hr6bgy/image/upload/v1789971027/bakery-cms/hna3kfojjhlnjlhudsjr.jpg";

/** The round frame, as a path, to recognise it by. */
const ROUND = "M0,0.5A0.5,0.5 0 1 0 1,0.5A0.5,0.5 0 1 0 0,0.5Z";

/**
 * Reduce a shape to a coarse grid of inside/outside, whatever drew it.
 *
 * Passed as source and `eval`ed inside the page, because a Playwright
 * `evaluate` gets a fresh scope and cannot see a helper defined out here.
 */
const SILHOUETTE = `(function (read) {
  const N = 24;
  let bits = "";
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      bits += read((col + 0.5) / N, (row + 0.5) / N) ? "1" : "0";
    }
  }
  return bits;
})`;

/** The same grid, for an SVG path given in fractions of its box. */
const RASTERISE = `(function (d, silhouette) {
  const N = 400;
  const canvas = document.createElement("canvas");
  canvas.width = N;
  canvas.height = N;
  const context = canvas.getContext("2d");
  context.setTransform(N, 0, 0, N, 0, 0);
  context.fill(new Path2D(d));
  const pixels = context.getImageData(0, 0, N, N).data;
  const read = (x, y) =>
    pixels[(Math.min(N - 1, Math.round(y * N)) * N + Math.min(N - 1, Math.round(x * N))) * 4 + 3] > 128;
  return eval(silhouette)(read);
})`;

function differ(a: string, b: string) {
  let count = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++;
  return count;
}

async function photoProducts(page: import("@playwright/test").Page) {
  await page.goto("/store/collections");
  await page.waitForTimeout(1800);
  const hrefs = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/store/cakes/"]')].map((a) => a.getAttribute("href")),
    ),
  ]);

  const found: string[] = [];
  for (const href of hrefs.slice(0, 12)) {
    await page.goto(href!);
    await page.waitForTimeout(1500);
    if (await page.getByText(OPENER).first().isVisible().catch(() => false)) found.push(href!);
  }
  return found;
}

/** What the editor's own canvas draws for this product, as a silhouette. */
async function frameDrawnBy(page: import("@playwright/test").Page, href: string) {
  await page.goto(href);
  await page.waitForTimeout(2400);
  await page.getByText(OPENER).first().click();
  await page.waitForTimeout(1500);

  const bits = await page.evaluate((silhouette) => {
    const canvas = document.querySelector('[role="dialog"] canvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    /*
      The empty frame is a faint tint on a white ground, so "inside" is simply
      "not the white outside it". The tint is 7% black — far enough from white
      to read at any sane threshold.
    */
    const read = (x: number, y: number) => {
      const px = Math.min(canvas.width - 1, Math.round(x * canvas.width));
      const py = Math.min(canvas.height - 1, Math.round(y * canvas.height));
      const i = (py * canvas.width + px) * 4;
      return (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3 < 250;
    };
    return (eval(silhouette) as (r: typeof read) => string)(read);
  }, SILHOUETTE);

  await page.keyboard.press("Escape");
  return bits;
}

test("the photo comes back in the shape it will be printed", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1280, height: 1100 });

  const products = await photoProducts(page);
  if (products.length === 0) {
    test.skip(true, "this shop sells no product that prints a photograph");
    return;
  }

  const round = await page.evaluate(
    ({ d, silhouette, rasterise }) =>
      (eval(rasterise) as (a: string, b: string) => string)(d, silhouette),
    { d: ROUND, silhouette: SILHOUETTE, rasterise: RASTERISE },
  );

  /* Walk until a product prints in something other than a circle. */
  let href: string | null = null;
  let fromCanvas: string | null = null;
  for (const candidate of products) {
    const bits = await frameDrawnBy(page, candidate);
    if (bits && differ(bits, round) > 24) {
      href = candidate;
      fromCanvas = bits;
      break;
    }
  }

  if (!href) {
    test.skip(
      true,
      `every one of this shop's ${products.length} photo products prints in a circle, so nothing here could tell a shaped thumbnail from a round one`,
    );
    return;
  }
  const slug = href.split("/").pop()!;

  /* ── what the THUMBNAIL clips to, on the product page and in the cart ── */
  const line = {
    id: "shape-probe-line",
    productSlug: slug,
    name: "Shape probe",
    price: 100,
    quantity: 1,
    image: PHOTO,
    photoUrl: PHOTO,
  };
  await page.evaluate(
    ([key, items]) => localStorage.setItem(key, JSON.stringify(items)),
    [CART_KEY, [line]] as [string, unknown],
  );

  async function clipPathOf(url: string) {
    await page.goto(url);
    await page.waitForTimeout(3200);
    return page.evaluate(() => {
      const img = document.querySelector("img[style*='clip-path']");
      if (!img) return null;
      const id = /url\(["']?#([^"')]+)/.exec(getComputedStyle(img).clipPath ?? "")?.[1];
      if (!id) return null;
      return document.querySelector(`#${CSS.escape(id)} path`)?.getAttribute("d") ?? null;
    });
  }

  const onProduct = await clipPathOf(`${href}?line=shape-probe-line`);
  const inCart = await clipPathOf("/store/cart");

  expect(onProduct, "the product page draws the photo with no clip at all").toBeTruthy();
  expect(inCart, "the cart draws the photo with no clip at all").toBeTruthy();

  /*
    THE CLAIM THAT CATCHES THE REAL BUG. The cart WAS clipping — to a circle,
    because the catalogue it is handed did not carry the frame, so every photo
    came back round whatever it was going to be printed in.
  */
  expect(inCart, "the cart and the product page clip the same photo to different shapes").toBe(
    onProduct,
  );

  /* ── and the clip agrees with what the editor drew ─────────────────── */
  const fromClip = await page.evaluate(
    ({ d, silhouette, rasterise }) =>
      (eval(rasterise) as (a: string, b: string) => string)(d, silhouette),
    { d: onProduct!, silhouette: SILHOUETTE, rasterise: RASTERISE },
  );

  const off = differ(fromCanvas!, fromClip);
  expect(
    off,
    `the thumbnail's shape and the editor's frame disagree on ${off} of ${fromCanvas!.length} samples\n` +
      `editor: ${fromCanvas}\n  clip: ${fromClip}`,
  ).toBeLessThanOrEqual(24);

  await page.evaluate((key) => localStorage.removeItem(key), CART_KEY);
});

test("and nothing is said under the button that the button does not say", async ({ page }) => {
  /*
    The line here read "Fit it in the frame, and add a name if you want one",
    one line under a button reading "Upload photo and write name". Two states
    still earn a line — an upload in flight, and the confirmation that the photo
    reached the shop — so this is about the EMPTY one only.
  */
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 1100 });

  const products = await photoProducts(page);
  if (products.length === 0) {
    test.skip(true, "this shop sells no product that prints a photograph");
    return;
  }

  await page.goto(products[0]!);
  await page.waitForTimeout(2400);

  const row = await page.evaluate(() => {
    const gate = document.querySelector("[data-gate-photo]");
    if (!gate) return null;
    return {
      lines: [...gate.querySelectorAll("p")].map((p) => (p.textContent ?? "").trim()),
      text: (gate.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  });

  expect(row, "there is no photo row on this product").not.toBeNull();
  expect(
    row!.lines,
    `the upload row says "${row!.lines.join(" / ")}" under a button that already said it`,
  ).toEqual([]);
});
