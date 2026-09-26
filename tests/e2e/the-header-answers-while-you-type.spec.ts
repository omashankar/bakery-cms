import { expect, test } from "@playwright/test";

/**
 * THE DROPDOWN, IN A BROWSER, BECAUSE NOTHING ELSE CAN ANSWER THESE.
 *
 * The unit test beside this one proves the ranking and the subset guarantee
 * over fixtures. It cannot say whether the panel is on the screen, whether the
 * shop's own products reach it, whether pressing Enter still goes where it
 * always went, or whether a phone has any way to search at all — and that last
 * one is the whole reason this work happened.
 *
 * WHAT THESE ARE WRITTEN AGAINST is the shape of browser test that passes
 * while pressing nothing. A spec that types, waits, and then asserts "the page
 * did not break" goes green with the dropdown deleted. So every check here
 * names a product the shop actually sells, or an address the browser actually
 * reached, and the two most important ones compare a BEFORE to an AFTER.
 */

const BOX = 'header input[type="search"]';
const PANEL = 'header [role="listbox"]';
const ROW = 'header [role="option"]';
/* Not the submit button inside the form, which carries the same label. */
const PHONE_ICON = 'header button[aria-label="Search"]:not([type="submit"])';

async function typeInto(page: import("@playwright/test").Page, text: string) {
  await page.click(BOX);
  await page.fill(BOX, "");
  await page.type(BOX, text, { delay: 45 });
  // The box is debounced at 180ms and then waits on a request.
  await page.waitForTimeout(1400);
}

test("offers the shop's own products while the customer is still typing", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator(BOX)).toBeVisible();

  /* ---- one letter is not a question ------------------------------------- */
  await typeInto(page, "c");
  expect(
    await page.locator(PANEL).count(),
    "a single letter opens a panel, which is a third of the catalogue as noise",
  ).toBe(0);

  /* ---- three more letters are ------------------------------------------- */
  await typeInto(page, "choc");
  await expect(page.locator(PANEL), "nothing was offered for 'choc'").toBeVisible();

  /*
    Read span by span, not off `textContent`. The name and the category are
    two block spans with no whitespace between them in the markup, so the
    concatenation reads "Choco Chip Brownie Cakein Pastries" — a regex over
    that cannot tell a category line from a name that happens to end in "in".
  */
  const rows = await page.locator(ROW).evaluateAll((nodes) =>
    nodes.map((node) => {
      const lines = [...node.querySelectorAll("span span")];
      return {
        href: node.getAttribute("href") ?? "",
        name: (lines[0]?.textContent ?? "").trim(),
        category: (lines[1]?.textContent ?? "").trim(),
        text: (node.textContent ?? "").toLowerCase(),
        hasPicture: Boolean(node.querySelector("img")?.getAttribute("src")),
      };
    }),
  );

  expect(rows.length, "the dropdown drew no rows").toBeGreaterThan(0);
  expect(rows.length, "the dropdown is a second results page").toBeLessThanOrEqual(6);

  /*
    EVERY ROW IS A REAL PRODUCT OF THIS SHOP, checked by where it points
    rather than by what it says — a row could print anything.
  */
  for (const row of rows) {
    expect(row.href, `a row points at ${row.href}`).toMatch(/^\/store\/cakes\/[a-z0-9-]+$/);
    expect(row.text, `a row does not mention what was typed: ${row.text}`).toContain("choc");
  }

  /*
    AND THE ROW SAYS WHICH GROUP IT IS IN, which is the disambiguation the
    shop asked for: the same words appear under more than one category.
  */
  const withCategory = rows.filter((row) => /^in\s+\S/.test(row.category));
  expect(
    withCategory.map((row) => row.category),
    `no row says which category its product sits in: ${JSON.stringify(rows.map((r) => r.category))}`,
  ).not.toEqual([]);

  expect(
    rows.some((row) => row.hasPicture),
    "no row drew a thumbnail",
  ).toBe(true);

  /* ---- and the first row is the closest match, not the first in the list -- */
  expect(
    rows[0]!.name.toLowerCase().startsWith("choc"),
    `the first row is "${rows[0]!.name}", which does not begin with what was typed`,
  ).toBe(true);
});

test("a row opens that product, and Enter still lands on the results page", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---- clicking a row --------------------------------------------------- */
  await page.goto("/store");
  await typeInto(page, "truffle");
  const target = await page.locator(ROW).first().getAttribute("href");
  expect(target, "there was no row to click").toBeTruthy();

  await page.locator(ROW).first().click();
  await page.waitForURL(/\/store\/cakes\//, { timeout: 30_000 });
  expect(page.url(), "clicking a suggestion went somewhere else").toContain(target!);

  /* ---- the keyboard ----------------------------------------------------- */
  await page.goto("/store");
  await typeInto(page, "velvet");
  const highlighted = await page.locator(ROW).first().getAttribute("href");
  await page.press(BOX, "ArrowDown");
  await page.waitForTimeout(250);
  expect(
    await page.locator(ROW).first().getAttribute("aria-selected"),
    "ArrowDown highlights nothing",
  ).toBe("true");
  await page.press(BOX, "Enter");
  await page.waitForURL(/\/store\/cakes\//, { timeout: 30_000 });
  expect(page.url(), "Enter on a highlighted row went somewhere else").toContain(highlighted!);

  /*
    ---- AND THE PLAIN ENTER IS UNTOUCHED ---------------------------------

    This is the one that would be quietly broken by a typeahead that
    pre-highlights its first row: the customer who types and presses Enter
    without ever looking down would stop reaching the results page and start
    being sent to whichever product the ranking put on top. Nothing on the
    screen would look wrong.
  */
  await page.goto("/store");
  await typeInto(page, "chocolate");
  await expect(page.locator(PANEL), "there was no open panel to press Enter past").toBeVisible();
  await page.press(BOX, "Enter");
  await page.waitForURL(/[?&]q=/, { timeout: 30_000 });
  expect(page.url(), "a plain Enter no longer reaches the results page").toContain(
    "/store/collections?q=chocolate",
  );

  /*
    ---- AND THE BOX REMEMBERS WHAT WAS SEARCHED ---------------------------

    It did not. The results page said "for chocolate" under a header box that
    had gone blank, so refining a search meant typing the whole word again.
  */
  await page.waitForTimeout(2000);
  expect(
    await page.inputValue(BOX),
    "the header box is empty on the page the search landed on",
  ).toBe("chocolate");
});

test("the magnifier in an empty box puts the cursor there, it does not leave the page", async ({
  page,
}) => {
  /*
    THE SHOP REPORTED THIS ONE TWICE, and the second time with an arrow drawn
    at the icon, because the first fix was aimed at the wrong control. The
    phone icon and the drawer row had both been moved off the collections page
    — and the magnifier INSIDE the box had not, because it is a submit button
    and a submit with an empty field is a GET to `/store/collections?q=`.

    So the control that looks most like "search" was the last one still
    behaving like the link this whole change set out to remove: click it with
    nothing typed and the shop takes you to its unfiltered grid.

    BOTH HALVES ARE CHECKED. Preventing the submit outright would break the
    only way to run a search with a pointer, so the guard has to prove that a
    click WITH a word in the box still reaches the results page. That is the
    half a careless fix silently breaks.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await expect(page.locator(BOX)).toBeVisible();

  const magnifier = page.locator('header form[role="search"] button[type="submit"]');

  /* ---- nothing typed ---------------------------------------------------- */
  await magnifier.click();
  await page.waitForTimeout(1500);

  expect(page.url(), "the magnifier still navigates to the collections page").not.toContain(
    "/store/collections",
  );
  expect(
    await page.evaluate((sel) => document.activeElement === document.querySelector(sel), BOX),
    "the magnifier did nothing at all — no cursor, no page",
  ).toBe(true);

  /* ---- and with a word in it -------------------------------------------- */
  await page.fill(BOX, "velvet");
  await magnifier.click();
  await page.waitForURL(/[?&]q=/, { timeout: 30_000 });
  expect(page.url(), "the magnifier no longer runs a search at all").toContain(
    "/store/collections?q=velvet",
  );
});

test("Escape puts the list away without throwing away the typing", async ({ page }) => {
  /*
    A `type="search"` field is not a plain text box: Chrome and Safari EMPTY it
    on Escape. So dismissing the suggestions also destroyed the half-typed word
    behind them. Found by a probe, not by reading the code — nothing in this
    repo says it, and it is invisible in a diff.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/store");
  await typeInto(page, "choc");
  await expect(page.locator(PANEL)).toBeVisible();

  await page.press(BOX, "Escape");
  await page.waitForTimeout(400);

  expect(await page.locator(PANEL).count(), "Escape left the list open").toBe(0);
  expect(await page.inputValue(BOX), "Escape emptied the box").toBe("choc");
});

test("and a phone gets a box to type in, where it used to get a page", async ({ page }) => {
  /*
    THE SHOP REPORTED THIS ONE. Below 640px the header has no room for a box,
    so it shows an icon — and that icon was a LINK to the unfiltered
    collections grid. The single search control a phone had could not search,
    and this shop's customers are on phones.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/store");
  await page.waitForTimeout(2500);

  expect(await page.locator(BOX).isVisible(), "a phone already has a box in the row").toBe(
    false,
  );

  const icon = page.locator(PHONE_ICON).first();
  await expect(icon, "a phone has no search control at all").toBeVisible();

  const before = page.url();
  await icon.click();
  await page.waitForTimeout(700);

  expect(page.url(), "tapping search navigated away instead of opening a box").toBe(before);
  await expect(page.locator(BOX), "tapping search opened nothing").toBeVisible();
  expect(
    await page.evaluate((sel) => document.activeElement === document.querySelector(sel), BOX),
    "the box opened without the keyboard",
  ).toBe(true);

  /* ---- and it is the same box, with the same suggestions ----------------- */
  await page.type(BOX, "choc", { delay: 45 });

  /*
    A RETRYING ASSERTION BEFORE THE COUNT, which the desktop cases above
    already had and this one did not.

    It read the row count straight after a fixed 1400ms wait. Measured on an
    idle machine the rows arrive 428ms after the last keystroke, twice over —
    so the wait is three times what it needs, and this still went red whenever
    anything else was running on the machine, reporting the shop's phone search
    as broken when it was not. The four cases above never did, because every
    one of them waits on the panel with `toBeVisible()` first, which retries.

    The count stays: a visible panel means `suggestions.length > 0`, so this
    is the assertion that a phone is offered rows and not merely a box.
  */
  await expect(
    page.locator(PANEL),
    "a phone was offered no suggestion panel at all",
  ).toBeVisible();
  expect(await page.locator(ROW).count(), "a phone gets no suggestions").toBeGreaterThan(0);

  /* ---- and none of it pushes the page sideways -------------------------- */
  const geometry = await page.evaluate(
    ({ panelSel }) => {
      const panel = document.querySelector(panelSel)?.getBoundingClientRect();
      const bar = document.querySelector("[data-header-bar]")?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        offRight: panel ? Math.round(panel.right - window.innerWidth) : 0,
        offLeft: panel ? Math.round(panel.left) : 0,
        /* The band drops BELOW the row rather than covering the logo. */
        underTheRow: panel && bar ? panel.top > bar.bottom : false,
      };
    },
    { panelSel: PANEL },
  );

  expect(geometry.overflow, "the phone search band gave the page a sideways scrollbar").toBe(0);
  expect(geometry.offRight, "the panel hangs off the right edge").toBeLessThanOrEqual(0);
  expect(geometry.offLeft, "the panel hangs off the left edge").toBeGreaterThanOrEqual(0);
  expect(geometry.underTheRow, "the panel covers the header row").toBe(true);
});
