import { expect, test, type Browser } from "@playwright/test";

import { connect } from "./shop-state";
import { openSignIn, probeEmail, removeCustomer, signInAsCustomer } from "./sign-in";

/**
 * A customer signing in, and finding their own orders.
 *
 * This is the whole point of the account, and until now none of it was real.
 * The sign-in modal waited 700ms and declared you signed in; any five digits
 * were accepted; and the identity it minted was `<phone>@customer.local`, an
 * address no order in the shop has ever carried. My Orders then read this
 * browser's localStorage, so a customer's history was device-bound, frozen at
 * the moment of placing, and blind to an order the payment webhook had placed.
 *
 * The two things that matter here cannot be checked any other way:
 *   - a wrong code does NOT sign anyone in
 *   - the SAME customer on a DIFFERENT browser sees the SAME orders
 *
 * The second is the one that proves the history left this device.
 */

test.describe("a customer with an account", () => {
  let email = "";
  let createdOrderId: unknown = null;

  test.afterAll(async () => {
    const db = await connect();
    if (createdOrderId) await db.collection("orders").deleteOne({ _id: createdOrderId as never });
    await removeCustomer(email);
  });

  test("signs in with an emailed code and sees the orders placed under that address", async ({
    page,
    browser,
  }) => {
    const db = await connect();
    // The shop's own sender, plus-tagged: a real mailbox, so a delivered code
    // proves delivery rather than proving a refusal.
    email = await probeEmail("e2e");

    /**
     * An order under that address, placed BEFORE the account exists.
     *
     * This is how it happens in the shop: people order first and sign in later.
     * The account has to find it, and it can only do that because both are
     * keyed on the same email — which is exactly what the old
     * `<phone>@customer.local` identity made impossible.
     */
    const inserted = await db.collection("orders").insertOne({
      orderNumber: `BK-E2E-${Date.now()}`,
      items: [{ id: "l1", productSlug: "x", name: "Test Cake", image: "", price: 500, quantity: 1 }],
      totals: { subtotal: 500, discount: 0, deliveryFee: 0, tax: 0, total: 500, itemCount: 1 },
      address: { fullName: "E2E Account", email, phone: "9000000001", city: "Mumbai", pincode: "400001" },
      paymentMethod: "cod",
      paymentStatus: "cod",
      status: "confirmed",
      statusHistory: [],
      placedAt: new Date().toISOString(),
      estimatedDelivery: new Date().toISOString(),
    });
    createdOrderId = inserted.insertedId;

    // ---- a wrong code signs nobody in ----
    await page.goto("/store");
    const modal = await openSignIn(page, email);
    await modal.getByRole("button", { name: /email me a code/i }).click();
    // Same relay budget as `signInAsCustomer` — see the note there.
    await expect(page.getByText(/enter the 6-digit code/i)).toBeVisible({ timeout: 60_000 });

    for (const index of [0, 1, 2, 3, 4, 5]) {
      await modal.getByLabel(`Code digit ${index + 1}`).fill("0");
    }
    await modal.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/not right|expired/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /'s account$/ }),
      "a wrong code signed the customer in",
    ).toHaveCount(0);

    // ---- the right one does ----
    await page.reload();
    await signInAsCustomer(page, email);

    await page.goto("/account/orders");
    await expect(
      page.getByText("Test Cake"),
      "the account cannot see an order placed under its own address",
    ).toBeVisible({ timeout: 20_000 });

    // ---- and it is not this browser's localStorage talking ----
    const cached = await page.evaluate(() => localStorage.getItem("bakery-cms-orders"));
    expect(
      cached === null || !String(cached).includes("Test Cake"),
      "the order was in this browser's cache, so this proves nothing about the server",
    ).toBe(true);

    // ---- a DIFFERENT browser, same customer ----
    await signInOnAnotherDevice(browser, email);
  });

  async function signInOnAnotherDevice(browser: Browser, address: string) {
    const context = await browser.newContext();
    const second = await context.newPage();
    try {
      await signInAsCustomer(second, address);
      await second.goto("/account/orders");

      // The whole point: history that left the device it was placed on.
      await expect(
        second.getByText("Test Cake"),
        "a second device cannot see the customer's orders — history is still device-bound",
      ).toBeVisible({ timeout: 20_000 });

      // ---- signing out ends it on the SERVER, not just here ----
      await second.getByRole("button", { name: /'s account$/ }).first().press("Enter");
      await second.getByRole("menuitem", { name: /^logout$/i }).press("Enter");
      await expect(second).toHaveURL(/\/store\/?$/);

      const me = await second.evaluate(async () => {
        const res = await fetch("/api/customer-auth/me", { credentials: "same-origin" });
        return (await res.json()).data;
      });
      expect(me, "the session survived a sign-out").toBeNull();
    } finally {
      await context.close();
    }
  }
});
