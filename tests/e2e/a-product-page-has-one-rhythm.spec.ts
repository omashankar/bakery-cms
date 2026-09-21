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

test("and every control in the column shares one left and one right edge", async ({ page }) => {
  /*
    THREE DIFFERENT RIGHT-HAND EDGES DOWN ONE SHORT STACK. The message box and
    the photo upload ran the full width of the column, the Add to Cart row ran
    the full width, and the PIN-code field stopped at 384px because it had been
    given `sm:max-w-sm` to leave room for an answer beside it. Seen on its own
    that row was fine; seen with the rest of the column it was the one thing out
    of line, which is the first thing the eye finds and the last thing it can
    un-see.

    Measured on the BLOCKS, not on a class name: a ragged edge is a fact about
    where things are drawn, and any number of different classes produce it.
    Zero-height children are skipped — several are `lg:hidden` — because a
    hidden box reports edges that mean nothing.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(2500);

  const edges = await page.evaluate(() => {
    const column = document.querySelectorAll("main .grid > div")[1];
    if (!column) return null;
    return [...column.children]
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter((entry) => entry.box.height > 1)
      .map((entry) => ({
        left: Math.round(entry.box.left),
        right: Math.round(entry.box.right),
        what:
          (entry.node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30) ||
          entry.node.tagName.toLowerCase(),
      }));
  });

  expect(edges, "the product page has no right-hand column").not.toBeNull();
  expect(edges!.length, "the column has too few blocks to line up").toBeGreaterThan(4);

  const lefts = [...new Set(edges!.map((entry) => entry.left))];
  const rights = [...new Set(edges!.map((entry) => entry.right))];

  expect(
    lefts,
    `blocks start at ${lefts.length} different left edges: ` +
      edges!.map((e) => `${e.left} ${e.what}`).join(" | "),
  ).toHaveLength(1);
  expect(
    rights,
    `blocks end at ${rights.length} different right edges: ` +
      edges!.map((e) => `${e.right} ${e.what}`).join(" | "),
  ).toHaveLength(1);
});

test("and Add to Cart is the biggest thing a customer can press", async ({ page }) => {
  /*
    It was the same height as the field above it, in a column where the tallest
    control was a message box. The reference storefront makes it plainly the
    largest — it is the one press the whole page is arranged around, and a
    primary action that matches its neighbours is a primary action only by
    colour.

    Compared against the controls around it rather than against 56px, so a
    change to the house sizing moves them together or fails here.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(2500);

  const sizes = await page.evaluate(() => {
    const grid = document.querySelectorAll("main .grid")[0];
    const add = [...(grid?.querySelectorAll("button") ?? [])].find((node) =>
      /add to cart|update cart|out of stock/i.test(node.textContent ?? ""),
    );
    const others = [...(grid?.querySelectorAll("input, textarea") ?? [])]
      .map((node) => Math.round(node.getBoundingClientRect().height))
      .filter((height) => height > 1);
    return {
      add: add ? Math.round(add.getBoundingClientRect().height) : 0,
      tallestOther: others.length ? Math.max(...others) : 0,
    };
  });

  expect(sizes.add, "there is no Add to Cart button").toBeGreaterThan(0);
  expect(
    sizes.add,
    `Add to Cart is ${sizes.add}px and the tallest field beside it is ${sizes.tallestOther}px`,
  ).toBeGreaterThanOrEqual(sizes.tallestOther);
});

test("and the magnifier shows more of the photo, not the same photo bigger", async ({ page }) => {
  /*
    THE PANEL WAS FED THE PAGE'S OWN COPY. It shows a slice at 2.5x across 416
    CSS pixels — 832 device pixels on most screens — and this shop's photographs
    are delivered at 600. Measured before the fix: a 240-pixel slice filling
    832, a 3.47x upscale. Not a closer look; the same photograph with its edges
    smeared, at the moment a customer is deciding whether to trust it.

    TWO THINGS ARE CHECKED AND BOTH MATTER. The panel must carry two background
    layers — the big file over the small one — so it is filled the instant it
    appears and sharpens when the larger arrives, rather than showing an empty
    card for the length of a fetch. And the top layer must actually decode
    wider than the one the page rendered, which is the part a URL-shaped
    assertion would miss: `magnifiableImageUrl` can return a longer string that
    the CDN answers at the same size.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(3000);

  const photo = page.locator('button[aria-label^="Zoom"]').first();
  await expect(photo, "the product has no photo to magnify").toBeVisible();

  const box = (await photo.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(2500);

  const panel = await page.evaluate(async () => {
    const node = document.querySelector('[data-testid="zoom-panel"]');
    if (!node) return null;
    const layers = [...getComputedStyle(node).backgroundImage.matchAll(/url\("?(.*?)"?\)/g)].map(
      (match) => match[1]!,
    );
    const widthOf = async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode().catch(() => {});
      return image.naturalWidth;
    };
    const onPage = document.querySelector("main img") as HTMLImageElement | null;
    return {
      layers: layers.length,
      sameUrl: layers.length === 2 && layers[0] === layers[1],
      big: layers[0] ? await widthOf(layers[0]) : 0,
      base: layers[1] ? await widthOf(layers[1]) : 0,
      rendered: onPage?.naturalWidth ?? 0,
    };
  });

  expect(panel, "no magnifier appeared on hover").not.toBeNull();
  expect(
    panel!.layers,
    "the panel draws one layer, so the first hover shows an empty card while it loads",
  ).toBe(2);

  /*
    A SHOP MAY HAVE UPLOADED A SMALL PHOTOGRAPH, and then there is nothing
    bigger to fetch — `c_limit` stops Cloudinary inventing it, which is right.
    Two of this shop's own uploads are 735px. So the assertion is "no smaller
    than the base, and big enough to be worth magnifying at all", not a fixed
    number that would fail on honest data.
  */
  expect(panel!.big, "the magnified layer did not load").toBeGreaterThan(0);
  expect(
    panel!.big,
    `the magnifier came back with ${panel!.big}px where the page already has ${panel!.base}px`,
  ).toBeGreaterThanOrEqual(panel!.base);

  /*
    A DIFFERENT URL, and this is the assertion that actually holds the change
    up. `big >= base` is satisfied by feeding the panel the SAME file twice —
    measured: reverting the fix and leaving both layers pointing at the page's
    own copy kept this test green until this line existed.

    Why not `big > base`: two of this shop's own uploads are 735px originals,
    so the larger request comes back the same size and `c_limit` is right to
    refuse to invent the difference. What can always be asserted is that the
    panel asked for its own copy rather than reusing the page's.
  */
  expect(
    panel!.sameUrl,
    "the magnifier is fed the page's own copy, so it can only ever upscale it",
  ).toBe(false);

  /*
    AND IT IS WORTH LOOKING AT. The panel was 416px against a 656px photograph
    — 0.63 of it — where the reference storefront's is about the same size as
    the picture it magnifies, and a magnifier smaller than its subject reads as
    a thumbnail rather than a closer look.

    Compared against the photograph rather than against a pixel count, because
    the column widths change with the viewport: measured at 1024, 1280, 1440
    and 1920 the panel runs 0.93 to 1.06 of the image, and never reaches the
    right-hand edge of the window.
  */
  const beside = await page.evaluate(() => {
    const photo = document.querySelector('button[aria-label^="Zoom"]')?.getBoundingClientRect();
    const node = document.querySelector('[data-testid="zoom-panel"]')?.getBoundingClientRect();
    if (!photo || !node) return null;
    return {
      ratio: node.width / photo.width,
      pastEdge: Math.round(node.right - window.innerWidth),
    };
  });

  expect(beside, "the panel vanished before it could be measured").not.toBeNull();
  expect(
    beside!.ratio,
    `the magnifier is ${beside!.ratio.toFixed(2)} of the photograph it magnifies`,
  ).toBeGreaterThan(0.85);
  expect(
    beside!.pastEdge,
    `the magnifier runs ${beside!.pastEdge}px past the right edge of the window`,
  ).toBeLessThanOrEqual(0);
});

test("and the photo viewer leaves nothing but the photo", async ({ page }) => {
  /*
    A PHOTOGRAPH IS JUDGED AGAINST WHAT SURROUNDS IT. The viewer used the house
    dialog dim of 45%, which left the shop's own cream and brown showing through
    — so a customer inspecting a cake was comparing it to the page rather than
    to nothing. Every other dialog on this site is a form or a message, where
    45% is right because it says the page is still there; this one is a viewer,
    where the job is the opposite.

    MEASURED, NOT READ OFF A CLASS. `overlayClassName` is a prop that a later
    change to `DialogContent` could stop forwarding without anything failing to
    compile, and a test that greps for "bg-black/85" would pass while the dim
    it names never reached the screen. So this samples the pixels: it
    screenshots a strip of the header, decodes it in the page and averages it,
    with the viewer shut and again with it open.

    Measured at the time of writing: 212 of 255 becomes 45. That is also the
    check that corrected me — the scaled-down screenshot looked as though the
    header was still lit, and it was not.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(3000);

  const strip = { x: 20, y: 25, width: 200, height: 40 };
  const brightnessOf = async () => {
    const shot = await page.screenshot({ clip: strip });
    return page.evaluate(async (data: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      for (let at = 0; at < pixels.length; at += 4) {
        total += (pixels[at]! + pixels[at + 1]! + pixels[at + 2]!) / 3;
      }
      return Math.round(total / (pixels.length / 4));
    }, shot.toString("base64"));
  };

  const lit = await brightnessOf();
  expect(lit, `the header is already dark at ${lit}, so this measures nothing`).toBeGreaterThan(
    150,
  );

  const opener = page.locator('button[aria-label^="Zoom"]').first();
  await expect(opener, "the product photo does not open a viewer").toBeVisible();
  await opener.click();
  await page.waitForTimeout(1200);

  await expect(page.locator('[role="dialog"]'), "the viewer did not open").toBeVisible();

  const dimmed = await brightnessOf();
  expect(
    dimmed,
    `the page behind the viewer is at ${dimmed} of 255, where it was ${lit}`,
  ).toBeLessThan(70);
});

test("and the offers are read at the page's own volume, not in a dashed box", async ({ page }) => {
  /*
    THE OFFERS ARE THE REASON SOMEBODY ADDS A SECOND ITEM, and they were the
    quietest block on the page: a dashed, tinted panel with the heading AND
    every line inside it painted in the brand brown at caption weight.

    A dashed border is what a browser and every design system use for something
    PROVISIONAL — a drop target, a placeholder — so the one block that says
    "here is money off" read as the least settled thing on the screen. And
    colouring the lines as well as the heading made the offers quieter than the
    product description below them.

    THE BULLETS ARE COMPARED AGAINST THE PAGE'S OWN BODY TEXT rather than
    against a hex value, so a change to the shop's palette moves both together
    or fails here. That is the assertion that catches "made quiet again",
    which no screenshot of a passing build would show.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(await anyProduct(page));
  await page.waitForTimeout(2500);

  const offers = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("p")].find((node) =>
      /available offers/i.test(node.textContent ?? ""),
    );
    if (!heading?.parentElement) return null;
    const block = heading.parentElement;
    const style = getComputedStyle(block);
    const line = block.querySelector("li span:last-child");
    /*
      The PAGE'S OWN text colour, read off `<body>` rather than off the first
      paragraph in `main`. That paragraph turned out to be a muted caption —
      the tax note under the price — so comparing against it asserted that the
      offers were as quiet as the quietest thing on the page, which is the
      opposite of the point.
    */
    const body = document.body;
    return {
      lines: block.querySelectorAll("li").length,
      borderStyle: style.borderTopStyle,
      borderWidth: Math.round(parseFloat(style.borderTopWidth)),
      background: style.backgroundColor,
      lineColour: line ? getComputedStyle(line).color : "",
      bodyColour: body ? getComputedStyle(body).color : "",
      lineSize: line ? Math.round(parseFloat(getComputedStyle(line).fontSize)) : 0,
    };
  });

  if (!offers || offers.lines === 0) {
    test.skip(true, "this shop is advertising no offers, so there is nothing to draw");
    return;
  }

  expect(offers.borderStyle, "the offers are back inside a dashed box").not.toBe("dashed");
  expect(offers.borderWidth, "the offers are back inside a box").toBe(0);
  expect(
    ["rgba(0, 0, 0, 0)", "transparent"],
    `the offers sit on a tinted panel: ${offers.background}`,
  ).toContain(offers.background);

  expect(
    offers.lineColour,
    `the offers are set in ${offers.lineColour} while the page reads in ${offers.bodyColour}`,
  ).toBe(offers.bodyColour);
  expect(offers.lineSize, `an offer is set at ${offers.lineSize}px`).toBeGreaterThanOrEqual(14);
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
