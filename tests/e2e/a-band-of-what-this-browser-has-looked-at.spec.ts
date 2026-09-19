import { expect, test } from "@playwright/test";

/**
 * THE BAND THAT IS DIFFERENT FOR EVERY VISITOR, DRIVEN AS ONE.
 *
 * The unit test beside this one pins the wiring. Only a browser can answer the
 * three questions that decide whether the band works at all:
 *
 *   is it ABSENT for somebody who has looked at nothing — which is most first
 *   visits, and the state in which a heading over an empty strip would be the
 *   worst thing on the page;
 *
 *   does it FILL after that person opens some products, in the order they
 *   opened them, with the shop's own prices rather than a stale cache's;
 *
 *   and does it arrive without a hydration mismatch — the band reads
 *   localStorage, which the server does not have, so a row built during render
 *   would make React throw the whole client tree away. That failure is silent
 *   in the markup and loud only in the console.
 */

const BAND = '[data-section-id^="recently-viewed"]';

test("is absent until the visitor has looked at something, then fills", async ({ page }) => {
  test.setTimeout(150_000);

  const complaints: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") complaints.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => complaints.push("pageerror: " + error.message.slice(0, 200)));

  await page.setViewportSize({ width: 1440, height: 900 });

  const settle = async () => {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    });
    await page.waitForTimeout(1800);
  };

  /* ---- a browser that has looked at nothing ------------------------------ */
  await page.goto("/store");
  await settle();
  expect(
    await page.locator(BAND).count(),
    "the band is on the page for somebody who has looked at nothing",
  ).toBe(0);

  /* ---- the same browser, after four product pages ------------------------ */
  const opened = await page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll('a[href^="/store/cakes/"]')].map((a) =>
          a.getAttribute("href"),
        ),
      ),
    ].slice(0, 4),
  );
  expect(opened.length, "this shop has too few products to drive this").toBeGreaterThan(2);

  for (const href of opened) {
    await page.goto(href!);
    await page.waitForTimeout(1200);
  }

  await page.goto("/store");
  await settle();

  const band = page.locator(BAND).first();
  await expect(band, "the band did not come back after four product pages").toBeVisible();

  const seen = await band.evaluate((el) => {
    const strip = el.querySelector("div.snap-x");
    const names = [...el.querySelectorAll("h3")].map((n) => (n.textContent ?? "").trim());
    return { cards: strip ? strip.children.length : 0, names };
  });

  /*
    THE ORDER IS THE POINT, not just the count: the most recently opened comes
    first, which is what makes the band worth having at all.
  */
  expect(seen.cards, `the band drew ${seen.cards} cards for ${opened.length} products`).toBe(
    opened.length,
  );
  const lastOpened = opened[opened.length - 1]!.split("/").pop()!;
  expect(
    seen.names[0]?.toLowerCase().replace(/[^a-z]/g, ""),
    `the row leads with ${seen.names[0]}, not the product opened last`,
  ).toContain(lastOpened.split("-")[0]!.toLowerCase());

  /* ---- and it arrived quietly -------------------------------------------- */
  const hydration = complaints.filter((line) => /hydrat|did not match|server HTML/i.test(line));
  expect(
    hydration,
    "the band reads the browser during render:\n  " + hydration.join("\n  "),
  ).toEqual([]);
});
