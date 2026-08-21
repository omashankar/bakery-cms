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
const PHOTO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#7A4D2B"/></svg>',
  ).toString("base64");

const PROFILE_KEY = "bakery-cms-admin-profile";

/** Seeded before the first paint — the header reads this store in its mount effect. */
async function seedProfile(
  page: Parameters<typeof adminSession>[0],
  profile: { fullName: string; email: string; photoUrl: string },
) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [PROFILE_KEY, JSON.stringify(profile)],
  );
}

test.describe("the admin account menu", () => {
  test("shows the photo the admin uploaded", async ({ page }) => {
    await adminSession(page);
    await seedProfile(page, {
      fullName: "Om Suman",
      email: "sumanom7014106@gmail.com",
      photoUrl: PHOTO,
    });

    await page.goto("/admin/profile");

    const trigger = page.getByLabel("Account menu");
    await expect(trigger).toBeVisible();

    const photo = trigger.locator("img");
    await expect(photo, "the uploaded photo never reached the header").toHaveCount(1);
    await expect(photo).toHaveAttribute("src", PHOTO);
  });
});
