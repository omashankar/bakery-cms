import { expect, test, type Page } from "@playwright/test";

import { probeEmail, removeCustomer, signInAsCustomer } from "./sign-in";

/**
 * What the NEXT person on this device can see.
 *
 * A bakery's own tablet, a family computer, an internet café. The customer
 * "session" is one localStorage key and signing out used to remove exactly that
 * key — so anything else the browser was holding survived into the next
 * person's session.
 *
 * Saved addresses are the sharp edge: they are a full name, a phone number and
 * a home address, stored under one browser-wide key
 * (`bakery-cms-customer-addresses`) with nothing tying a record to the customer
 * who saved it. Checkout offers them as a picker.
 */

const ADDRESS_KEY = "bakery-cms-customer-addresses";
const CART_KEY = "bakery-cms-cart";


/**
 * Signs out the way a customer does: the account menu in the header.
 *
 * NOT by removing the session key. An earlier version of this spec did exactly
 * that, and went on failing after the fix landed because removing the key
 * bypasses `clearCustomerSession()` — the entire function under test. A test
 * that simulates the action it means to exercise proves nothing about it.
 */
async function signOutThroughTheUi(page: Page) {
  // Driven by the keyboard. The account menu opens on hover as well as click,
  // and a mouse click on "Logout" races the open animation — Playwright saw the
  // item, called it unstable, and then watched it detach. Keyboard activation
  // goes through the same handler a mouse click does.
  const trigger = page.getByRole("button", { name: /'s account$/ }).first();
  await expect(trigger).toBeVisible();
  await trigger.press("Enter");

  const logout = page.getByRole("menuitem", { name: /^logout$/i });
  await expect(logout, "the account menu did not open").toBeVisible();
  await logout.press("Enter");

  await expect(page, "Logout did not return the customer to the storefront").toHaveURL(
    /\/store\/?$/,
  );
}

test.describe("a shared device", () => {
  let asha = "";
  let bilal = "";

  test.afterEach(async () => {
    await removeCustomer(asha);
    await removeCustomer(bilal);
  });

  test("does not hand the next customer the previous one's address book", async ({ page }) => {
    // ---- customer A signs in and saves an address ----
    asha = await probeEmail("asha");
    await signInAsCustomer(page, asha);

    await page.evaluate(
      ([key, record]) => localStorage.setItem(key as string, JSON.stringify([record])),
      [
        ADDRESS_KEY,
        {
          id: "addr-asha",
          label: "Home",
          isDefault: true,
          fullName: "Asha Menon",
          email: "asha@example.com",
          phone: "9812345678",
          addressLine1: "12 Private Street",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as const,
    );

    await signOutThroughTheUi(page);

    // ---- B signs in on the same browser ----
    bilal = await probeEmail("bilal");
    await signInAsCustomer(page, bilal);

    const leftBehind = await page.evaluate((key) => localStorage.getItem(key as string), ADDRESS_KEY);

    // Bilal must not be holding Asha's name, phone and street address.
    expect(
      leftBehind === null || leftBehind === "[]" || !leftBehind.includes("12 Private Street"),
      "the previous customer's saved address survived their sign-out",
    ).toBe(true);
  });

  test("does not leave the previous customer's cart behind", async ({ page }) => {
    asha = await probeEmail("asha");
    await signInAsCustomer(page, asha);
    await page.goto("/store");
    const firstProduct = page.locator('a[href^="/store/cakes/"]').first();
    await expect(firstProduct).toBeVisible();
    await page.goto((await firstProduct.getAttribute("href"))!);
    await page.getByRole("button", { name: /add to cart/i }).first().click();

    // Asha's cart really has something in it. Without this the assertion at the
    // end passes for the wrong reason — an empty cart because the add never
    // happened reads exactly like an empty cart because sign-out cleared it.
    await page.goto("/store/cart");
    await expect(
      page.getByRole("button", { name: /remove item/i }).first(),
      "the item was never added, so this test would prove nothing",
    ).toBeVisible();

    await signOutThroughTheUi(page);

    bilal = await probeEmail("bilal");
    await signInAsCustomer(page, bilal);

    /**
     * Asserted against storage, not against the rendered page.
     *
     * Two earlier versions of this check passed while the cart was still there:
     * `toHaveCount(0)` succeeds the instant it runs on a page that has not
     * hydrated, and waiting for the heading is not enough because the heading
     * renders in both the empty and the filled state. An absence is only worth
     * asserting where its presence would be unambiguous.
     */
    const leftBehind = await page.evaluate((key) => localStorage.getItem(key as string), CART_KEY);

    // Less sensitive than an address, but still someone else's shopping.
    expect(
      leftBehind === null || leftBehind === "[]",
      "the previous customer's cart survived their sign-out",
    ).toBe(true);
  });
});

test.describe("a shared device", () => {
  /**
   * `grantOrderAccess` writes TWO things when a customer proves they own an
   * order: the number into `bakery-cms-verified-orders`, and the email that
   * proved it into a sibling key PER ORDER —
   * `bakery-cms-verified-orders:lookup:BK-…`.
   *
   * Sign-out cleared the exact key and not the siblings. The sibling is the one
   * the order page and the success page read to fetch that order from the
   * server, so the next person in the tab could open the previous customer's
   * order and read their name, phone, email and full delivery address.
   */
  test("does not leave the previous customer's proof of order ownership", async ({ page }) => {
    const asha = await probeEmail("asha");
    await signInAsCustomer(page, asha);

    // Exactly what grantOrderAccess writes, under both storages.
    await page.evaluate(() => {
      sessionStorage.setItem("bakery-cms-verified-orders", JSON.stringify(["BK-1", "BK-2"]));
      sessionStorage.setItem("bakery-cms-verified-orders:lookup:BK-1", "asha@example.com");
      sessionStorage.setItem("bakery-cms-verified-orders:lookup:BK-2", "asha@example.com");
      localStorage.setItem("bakery-cms-verified-orders:lookup:BK-3", "asha@example.com");
    });

    await signOutThroughTheUi(page);

    const leftBehind = await page.evaluate(() => {
      const found: string[] = [];
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i += 1) {
          const key = store.key(i);
          if (key?.startsWith("bakery-cms-verified-orders")) found.push(key);
        }
      }
      return found;
    });

    expect(
      leftBehind,
      "the next customer can still fetch the previous one's orders from the server",
    ).toEqual([]);
  });
});
