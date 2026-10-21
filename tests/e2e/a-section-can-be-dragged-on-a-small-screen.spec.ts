import { expect, test, type Page } from "@playwright/test";
import { adminSession } from "./admin-session";

/**
 * A SECTION CAN BE DRAGGED INTO PLACE ON A LAPTOP SCREEN.
 *
 * At 1280x720 the builder's section list is about 300px tall, and its two
 * fixed 56px auto-scroll zones were a third of it. A row grabbed near the
 * bottom started the list scrolling DOWN the moment it was picked up, while
 * the admin dragged it UP — the row slid out from under the pointer and the
 * drop changed nothing. Measured: the pointer travelled 176px, the row 39px.
 * At 1920x1080 the same drag worked, which is why it went unnoticed.
 *
 * Nothing is saved: every write to the layout is refused before it leaves.
 */
test.use({ viewport: { width: 1280, height: 720 } });

const handles = (page: Page) => page.locator('button[aria-label^="Drag to reorder"]');

async function order(page: Page) {
  return handles(page).evaluateAll((els) =>
    els.map((el) => (el.getAttribute("aria-label") ?? "").replace("Drag to reorder ", "")),
  );
}

/** At a hand's pace — a drag with no time between moves is not one a person makes. */
async function drag(page: Page, from: number, to: number) {
  const a = (await handles(page).nth(from).boundingBox())!;
  const b = (await handles(page).nth(to).boundingBox())!;
  const x = a.x + a.width / 2;
  const startY = a.y + a.height / 2;
  const endY = b.y + b.height / 2 + (to > from ? 10 : -10);
  await page.mouse.move(x, startY);
  await page.mouse.down();
  for (let step = 1; step <= 25; step += 1) {
    await page.mouse.move(x, startY + ((endY - startY) * step) / 25);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

test("a section dragged up and then down lands where it was dropped", async ({ page }) => {
  test.setTimeout(180_000);
  await page.route("**/api/homepage-sections**", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
  await adminSession(page);
  await page.goto("/admin/builders/homepage");
  await expect(page.locator("[data-builder-preview] [data-section-id]").first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(handles(page).nth(4)).toBeVisible();

  const before = await order(page);

  await drag(page, 3, 1);
  const up = await order(page);
  expect(up, "dragging the fourth row up to second moved nothing").toEqual([
    before[0],
    before[3],
    before[1],
    before[2],
    ...before.slice(4),
  ]);

  await drag(page, 1, 2);
  const down = await order(page);
  expect(down, "dragging the second row down one place moved nothing").toEqual([
    up[0],
    up[2],
    up[1],
    ...up.slice(3),
  ]);

  // The change is held as an edit, waiting to be saved.
  await expect(page.getByText("Unsaved")).toBeVisible();
});
