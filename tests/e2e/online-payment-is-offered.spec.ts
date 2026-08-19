import { expect, test } from "@playwright/test";

import { probeEmail, signInAsCustomer } from "./sign-in";

/**
 * Can a customer actually pay online?
 *
 * Two gates decide, and they live in different places: the shop's own
 * `commerce.paymentMethods.razorpay` switch, and whether the server has
 * Razorpay keys at all (`/api/razorpay/availability`). Checkout hides the
 * option unless BOTH say yes — deliberately, because offering "Pay Online"
 * with no keys lets a customer complete the whole checkout and only find out at
 * the final click.
 *
 * That means "online payment is not showing" has two very different causes, and
 * neither is visible from the storefront. This walks the real checkout and says
 * which one it is.
 *
 * It stops at the Razorpay modal rather than paying. The modal only opens after
 * `/api/razorpay/order` has minted a real order against the shop's keys, so its
 * appearance is the proof that the keys work end to end — and completing the
 * payment would drive a third party's iframe and leave a paid order in the
 * shop's database.
 */
test.describe("paying online", () => {
  test("is offered at checkout when the shop has it switched on", async ({ page }) => {
    const available = await page.request.get("/api/razorpay/availability");
    const status = (await available.json()) as { configured?: boolean; testMode?: boolean };

    test.skip(
      !status.configured,
      "this shop has no Razorpay keys, so checkout is right to offer only cash",
    );

    const customerEmail = await probeEmail("pay");
    await signInAsCustomer(page, customerEmail);

    await page.goto("/store");
    const firstProduct = page.locator('a[href^="/store/cakes/"]').first();
    await expect(firstProduct).toBeVisible();
    const href = await firstProduct.getAttribute("href");
    expect(href, "the storefront lists no product to open").toBeTruthy();

    await page.goto(href!);
    await page.getByRole("button", { name: /add to cart/i }).first().click();

    await page.goto("/store/cart");
    await page.getByRole("button", { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/store\/checkout/);

    // ---- the address step, exactly as place-an-order does it ----
    await page.getByLabel(/full name/i).fill("E2E Pay Probe");
    await page.getByLabel(/email/i).fill(customerEmail);
    await page.getByLabel(/phone/i).fill("9000000002");
    await page.getByLabel(/address line 1|address/i).first().fill("2 Probe Lane");
    await page.getByLabel(/city/i).fill("Mumbai");
    await page.getByLabel(/state/i).fill("MH");
    await page.getByLabel(/PIN code/i).fill("400001");

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

    // ---- the payment step ----
    const online = page.getByText(/pay online/i).first();
    await expect(
      online,
      "checkout offers no online payment even though the server has keys — " +
        "commerce.paymentMethods.razorpay is off in Settings → Commerce",
    ).toBeVisible();

    // Cash has to survive too. An earlier shape of this gate hid every method
    // it could not confirm, which would have left a checkout with no way to pay
    // at all.
    await expect(
      page.getByText(/cash on delivery/i).first(),
      "cash on delivery disappeared alongside it",
    ).toBeVisible();

    await online.click();
    await page.getByRole("button", { name: /continue|next|review/i }).first().click();

    /**
     * The button that PAYS, anchored at the start of its name.
     *
     * A loose `/pay/i` also matches the stepper's "✓ Payment — completed, go
     * back to edit", which sits earlier in the DOM — so `.first()` clicked the
     * breadcrumb, walked back a step, and the test then waited thirty seconds
     * for a request the page had every reason not to make.
     */
    const placeOrder = page
      .getByRole("button", { name: /^(pay\b|place order)/i })
      .filter({ hasNotText: /go back|edit/i })
      .first();
    await expect(placeOrder, "the review step never became payable").toBeEnabled();

    /**
     * The gateway's own answer, watched as it happens.
     *
     * `/api/razorpay/order` is the call that proves the keys work: the server
     * sends them to Razorpay and gets an order id back. A 4xx here is the
     * failure a customer would meet at the very last click, and it is the whole
     * reason this test exists rather than a source-level one.
     */
    const minted = page.waitForResponse(
      (response) => response.url().includes("/api/razorpay/order"),
      { timeout: 30_000 },
    );

    await placeOrder.click();

    const response = await minted;
    // This route answers in its own shape, not the app's `{data}` envelope —
    // the first version of this test read `body.data.id`, got undefined from a
    // perfectly good 200, and reported a working gateway as broken.
    const body = (await response.json().catch(() => null)) as {
      orderId?: string;
      amount?: number;
      keyId?: string;
      error?: string;
    } | null;

    expect(
      response.status(),
      `Razorpay refused the shop's keys — a customer would meet this at the final click: ${body?.error ?? ""}`,
    ).toBe(200);
    expect(body?.orderId, "the gateway returned no order to pay against").toBeTruthy();
    // In paise, and it has to be the cart's total — the amount is the server's
    // to decide, and a client-chosen one was once the money hole here.
    expect(body?.amount, "the gateway order carries no amount").toBeGreaterThan(0);
    expect(body?.keyId, "the browser was given no key to open the window with").toBeTruthy();

    /**
     * And it reaches the customer as a payment window.
     *
     * The response above could be perfect while the script fails to load or the
     * handler never opens anything — which looks, from the customer's side,
     * exactly like a button that does nothing.
     */
    await expect(
      page.locator('iframe[src*="razorpay"], .razorpay-container').first(),
      "the payment window never opened",
    ).toBeVisible({ timeout: 30_000 });
  });
});
