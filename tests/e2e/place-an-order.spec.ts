import { expect, test } from "@playwright/test";

import { connect } from "./shop-state";
import { probeEmail, removeCustomer, signInAsCustomer } from "./sign-in";

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
  let customerEmail = "";

  test.afterAll(async () => {
    await removeCustomer(customerEmail);
  });

  test("can go from a product page to a placed order", async ({ page }) => {
    /**
     * Signed in for real.
     *
     * This used to plant `bakery-cms-customer-session` in localStorage, and the
     * comment here said that WAS the mechanism, "not a shortcut around it;
     * there is no server-side customer auth to go through". That was true when
     * it was written. There is one now: the session is an httpOnly cookie the
     * browser cannot write, and every page asks the server — so a planted key
     * is cleared within a round trip of being planted, and this test would
     * bounce off checkout with "Please sign in to continue".
     */
    customerEmail = await probeEmail("order");
    await signInAsCustomer(page, customerEmail);

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
    await page.getByLabel(/email/i).fill(customerEmail);
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

    /**
     * Record what the page SAYS and where it tries to go, as it happens.
     *
     * Checking for a toast after the fact cannot work: sonner dismisses in a
     * few seconds and placing an order takes tens of them, so an assertion at
     * the end passes whether or not the toast ever appeared. An earlier version
     * of this check did exactly that and could not tell the bug from the fix.
     *
     * The App Router navigates without replacing the document, so an observer
     * and a patched history survive the trip to the success page.
     */
    await page.evaluate(() => {
      const w = window as unknown as { __said: string[]; __went: string[] };
      w.__said = [];
      w.__went = [];
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            const text = (node as HTMLElement).textContent?.trim();
            if (text) w.__said.push(text);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });

      for (const method of ["pushState", "replaceState"] as const) {
        const original = history[method].bind(history);
        history[method] = ((state: unknown, title: string, url?: string) => {
          if (url) w.__went.push(String(url));
          return original(state, title, url);
        }) as typeof history.pushState;
      }
    });

    await placeOrder.click();

    // ---- the shop says it happened ----
    await expect(page).toHaveURL(/\/store\/order\/(success|BK-)/i, { timeout: 60_000 });

    /**
     * And it does not contradict itself on the way there.
     *
     * `commitPlacedOrder` clears the cart, which fires checkout's cart
     * subscriber — and that subscriber treats an empty cart as the customer
     * having removed everything: it toasted "Your cart is now empty — add a
     * cake to check out" and `router.replace`d to the cart, racing the push to
     * this page. The customer's order had just succeeded.
     */
    const { said, went } = await page.evaluate(() => {
      const w = window as unknown as { __said: string[]; __went: string[] };
      return { said: w.__said, went: w.__went };
    });

    expect(
      said.filter((text) => /cart is now empty/i.test(text)),
      "checkout said the cart was empty at the moment the order succeeded",
    ).toEqual([]);
    expect(
      went.filter((url) => /\/store\/cart/.test(url)),
      "checkout tried to send the customer back to the cart as the order succeeded",
    ).toEqual([]);

    // ---- and it really did ----
    const db = await connect();
    const placed = await db
      .collection("orders")
      .findOne({ "address.email": customerEmail });

    expect(placed, "the success page appeared but no order reached the database").toBeTruthy();
    expect(placed!.status).toBeTruthy();
    // The SHOP's price, not the browser's.
    expect(placed!.totals.total).toBeGreaterThan(0);
  });
});
