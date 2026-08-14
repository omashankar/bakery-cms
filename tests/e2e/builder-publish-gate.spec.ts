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
  { name: "wedding", path: "/admin/builders/wedding", api: "**/api/wedding-sections" },
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
