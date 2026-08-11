import { expect, test } from "@playwright/test";

import { connect } from "./shop-state";

/**
 * The one journey the whole shop exists for, driven the way a customer drives
 * it: click a cake, add it, check out, pay cash on delivery, and land on a page
 * that says the order was placed.
 *
 * Everything about this flow has been verified from the outside until now —
 * HTTP probes against `/api/orders`, unit tests over the pricing rules — and
 * none of that presses a button. A Place-order that never enables, a step that
 * cannot be advanced, a total the browser computes differently from the server:
 * all invisible to the tests this repo had.
 *
 * The order it places is real, and the global teardown removes it by id and puts
 * the stock back.
 */
test.describe("a customer placing an order", () => {
  test("can go from a product page to a placed order", async ({ page }) => {
    /**
     * Signed in as a customer, which today means one localStorage key.
     *
     * `customer-session.ts` says so itself — "UI-only customer session —
     * replaced by real auth later" — and checkout gates on it: pressing
     * "Proceed to checkout" without one opens the sign-in modal instead of
     * navigating. Seeding the key IS the real mechanism, not a shortcut around
     * it; there is no server-side customer auth to go through.
     */
    await page.addInitScript(() => {
      localStorage.setItem(
        "bakery-cms-customer-session",
        JSON.stringify({
          email: "e2e-probe@example.com",
          name: "E2E Probe",
          phone: "9000000001",
          signedInAt: new Date().toISOString(),
        }),
      );
    });

    // ---- find a cake that can actually be bought ----
    await page.goto("/store");
    await expect(page).toHaveTitle(/./);

    const firstProduct = page.locator('a[href^="/store/cakes/"]').first();
    await expect(firstProduct).toBeVisible();
    const href = await firstProduct.getAttribute("href");
    expect(href, "the storefront lists no product to open").toBeTruthy();

    await page.goto(href!);

    // ---- add it to the cart ----
    const addToCart = page.getByRole("button", { name: /add to cart/i }).first();
    await expect(addToCart, "the product page offers no way to add to the cart").toBeVisible();
    await addToCart.click();

    // ---- the cart knows about it ----
    await page.goto("/store/cart");
    await expect(
      page.getByRole("button", { name: /remove item/i }).first(),
      "the cart is empty — Add to Cart did not add anything",
    ).toBeVisible();

    // Clicked, not navigated to. A direct `goto("/store/checkout")` bounces
    // back to the cart, which is worth knowing but is not what a customer does.
    await page.getByRole("button", { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/store\/checkout/);

    // ---- the address step ----
    await page.getByLabel(/full name/i).fill("E2E Probe");
    await page.getByLabel(/email/i).fill("e2e-probe@example.com");
    await page.getByLabel(/phone/i).fill("9000000001");
    await page.getByLabel(/address line 1|address/i).first().fill("1 Probe Lane");
    await page.getByLabel(/city/i).fill("Mumbai");
    await page.getByLabel(/state/i).fill("MH");
    await page.getByLabel(/PIN code/i).fill("400001");

    // The shop requires a delivery date and slot, and both are enforced on the
    // server — the date must be a real calendar day at or after the lead time,
    // and the slot must be one the shop offers.
    const earliest = new Date();
    earliest.setDate(earliest.getDate() + 5);
    const isoDay = [
      earliest.getFullYear(),
      String(earliest.getMonth() + 1).padStart(2, "0"),
      String(earliest.getDate()).padStart(2, "0"),
    ].join("-");
    await page.getByLabel(/delivery date/i).fill(isoDay);

    const slot = page.getByLabel(/delivery time/i);
    const options = await slot.locator("option").allTextContents();
    const firstReal = options.find((text) => text && !/select a time/i.test(text));
    if (firstReal) await slot.selectOption({ label: firstReal });

    await page.getByRole("button", { name: /continue|next/i }).first().click();

    // ---- pay on delivery, and place it ----
    const cod = page.getByText(/cash on delivery/i).first();
    if (await cod.isVisible().catch(() => false)) await cod.click();

    await page.getByRole("button", { name: /continue|next|review/i }).first().click();

    const placeOrder = page.getByRole("button", { name: /place order/i });
    await expect(placeOrder, "Place order never became available").toBeEnabled();
    await placeOrder.click();

    // ---- the shop says it happened ----
    await expect(page).toHaveURL(/\/store\/order\/(success|BK-)/i, { timeout: 60_000 });

    // ---- and it really did ----
    const db = await connect();
    const placed = await db
      .collection("orders")
      .findOne({ "address.email": "e2e-probe@example.com" });

    expect(placed, "the success page appeared but no order reached the database").toBeTruthy();
    expect(placed!.status).toBeTruthy();
    // The SHOP's price, not the browser's.
    expect(placed!.totals.total).toBeGreaterThan(0);
  });
});
