import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * The profile photo, in the header that should show it everywhere else.
 *
 * `admin-header.tsx` imported `Avatar` and `AvatarFallback` and nothing else, so
 * there was no element for a photo to render into — an admin who uploaded one
 * saw it on their own profile screen and nowhere else in the panel.
 *
 * The initials were the second half of the same fault: they came from the EMAIL,
 * so someone called "Om Suman" signing in as sumanom7014106@ was labelled "SU",
 * next to their own name in the same menu, while the profile screen a click away
 * derived "OS" from the name.
 *
 * Driven through the real header, because the fault was the wiring between the
 * profile store and the header rather than either piece on its own.
 *
 * Each case gets its own test so it gets its own browser context: `addInitScript`
 * accumulates within one, and two scripts writing the same key is a race about
 * ordering rather than a test about avatars.
 */
test.describe("the admin account menu", () => {
  /*
    THE SERVER'S PROFILE, NOT A SEEDED ONE. This used to plant a photo in
    localStorage and expect the header to show it — but the header is given
    the profile by the server now, before any browser store is read, so the
    seed lost to the real photo and the test failed on a header that was
    working. It checks the stored photo instead, and that it arrives at the
    size it is drawn: the original was 1.7 MB in a 28px circle on every page.
  */
  test("shows the photo the admin uploaded, at the size it is drawn", async ({ page }) => {
    await adminSession(page);
    await page.goto("/admin/profile");

    const trigger = page.getByLabel("Account menu");
    await expect(trigger).toBeVisible();

    const stored = await page.evaluate(async () => {
      const body = await (await fetch("/api/admin-config/admin-profile")).json().catch(() => null);
      const data = body?.data;
      return String(data?.photoUrl ?? data?.value?.photoUrl ?? "");
    });
    test.skip(!stored, "this admin has not uploaded a photo");

    const photo = trigger.locator("img");
    await expect(photo, "the uploaded photo never reached the header").toHaveCount(1);
    const src = (await photo.getAttribute("src")) ?? "";
    // The same file, whatever was put in front of it.
    expect(src).toContain(stored.split("/upload/").pop()!);
    if (stored.includes("res.cloudinary.com")) {
      expect(src, "the header downloads the full-size original").toMatch(
        /\/upload\/f_auto,q_auto,w_\d{2},c_limit\//,
      );
    }
  });
});
