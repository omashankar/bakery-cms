import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * Publish must not be clickable before the builder has read the layout.
 *
 * Both builders PUT the entire section array they hold in memory. That array
 * starts `[]` and stays `[]` until the opening fetch resolves — forever, if that
 * fetch THREW, because the failure path only toasts and leaves the screen up.
 * Publish was live the whole time, so one click in that window replaced the LIVE
 * storefront homepage with nothing. The confirm dialog says only "This updates
 * the live /store homepage for everyone" and never names a section count.
 *
 * Only a browser can tell the fix from the bug: the source contains the disabled
 * expression either way, and a structural test cannot see whether the flag it
 * reads is ever false. So this drives the real screen with the real failure —
 * the state fetch answered 500 — and asks the button whether it would fire.
 */
const BUILDERS = [
  { name: "homepage", path: "/admin/builders/homepage", api: "**/api/homepage-sections" },
];

for (const builder of BUILDERS) {
  test(`${builder.name} builder cannot publish a layout it never read`, async ({ page }) => {
    await adminSession(page);

    // The read fails; the write is left alone so a click would genuinely reach
    // the server. Nothing here stops the request but the button itself.
    let writes = 0;
    await page.route(builder.api, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: "down" }) });
        return;
      }
      writes += 1;
      await route.continue();
    });

    await page.goto(builder.path);

    const publish = page.getByRole("button", { name: /^publish/i });
    await expect(publish).toBeVisible();
    await expect(publish, "Publish is live with no layout in memory").toBeDisabled();

    // Says why, rather than looking broken.
    await expect(publish).toHaveAttribute("title", /waiting for the saved layout/i);

    // A disabled button that still fires would pass the assertion above.
    await publish.click({ force: true }).catch(() => {});
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // Publish is not the only thing that writes the in-memory array. Setting a
    // schedule saves the draft to carry the date, and this Preview saves first
    // so the new window has something to read — both would have written `[]`.
    await page.getByLabel(/schedule publish/i).fill("2027-01-01T09:00").catch(() => {});
    await page.getByRole("button", { name: /^preview$/i }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);

    expect(writes, "a write reached the server after a failed read").toBe(0);
  });

  test(`${builder.name} builder publishes once the layout is in hand`, async ({ page }) => {
    // The other half: the gate must open on a healthy load, or it is just a
    // broken Publish button.
    await adminSession(page);
    await page.goto(builder.path);

    await expect(page.getByRole("button", { name: /^publish/i })).toBeEnabled();
  });
}

/**
 * AND THE ADD LIST IS NOT THE WHOLE REGISTRY.
 *
 * Two entries are `legacy`: `photo-cakes` and `eggless`, bakery slugs frozen
 * into the section type and kept because layouts already published carry them
 * — this shop’s homepage has one. The reason for keeping them covers
 * RENDERING; it never covered offering them, and a florist opening this dialog
 * read "Photo Cakes" and "Eggless Cakes" among the things it could build its
 * page from.
 *
 * ONLY A BROWSER CAN SETTLE THIS ONE. The unit guard beside it imports the
 * same `ADDABLE_SECTION_REGISTRY` the builder does, so it cannot see the
 * builder naming the OTHER constant — a mutation proved exactly that. What
 * the dialog actually drew is the only answer to that question.
 */
test("the Add section dialog offers no legacy bakery rows", async ({ page }) => {
  test.setTimeout(300_000);
  await adminSession(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/admin/builders/homepage");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000);

  await page.getByRole("button", { name: /add section/i }).first().click();
  await page.getByText("Add homepage section").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);

  const offered = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((node) =>
      (node.textContent ?? "").includes("Add homepage section"),
    );
    if (!dialog) return null;
    return [...dialog.querySelectorAll("button")]
      .map((node) => (node.textContent ?? "").trim())
      .filter((text) => text && !/^(cancel|close)$/i.test(text));
  });

  expect(offered, "the Add section dialog never opened").not.toBeNull();
  /* A FLOOR. An empty list would satisfy every `not.toContain` below. */
  expect(offered!.length, "the dialog offered nothing at all").toBeGreaterThan(20);

  expect(offered, "a florist is offered Photo Cakes").not.toContain("Photo Cakes");
  expect(offered, "a florist is offered Eggless Cakes").not.toContain("Eggless Cakes");

  /*
    AND NO ROW SHOUTS IN LOWER CASE. `{Products}` returned the shop’s plural
    as typed, so this shop — whose plural is "products" — read "products by
    category" at the head of a Title Case list.
  */
  expect(
    offered!.filter((text) => /^[a-z]/.test(text)),
    "a row in a Title Case list starts in lower case",
  ).toEqual([]);
});
