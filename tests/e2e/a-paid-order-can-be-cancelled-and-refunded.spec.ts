import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect, PROBE_ADDRESS } from "./shop-state";
import { probeEmail, removeCustomer, signInAsCustomer } from "./sign-in";
import { bookDeliverySlot } from "./delivery-slot";
import { pinDeliveryDoor } from "./delivery-pin";

/**
 * The cancel-and-refund journey, end to end, on a Razorpay TEST key.
 *
 * Two real paid orders, because the rule has two sides:
 *
 *  1. Before the kitchen starts, the customer cancels from My Orders. That
 *     opens a refund request; the admin issues it, and the gateway (test mode)
 *     takes it.
 *  2. Once the admin moves an order to "preparing", the customer can no longer
 *     cancel — the button is gone AND the server refuses. The admin can still
 *     cancel it, and declining the refund it opens is recorded as declined.
 *
 * Opt-in like the payment spec it builds on: it drives Razorpay's own window.
 * The orders are removed by the global teardown, by id, with their stock.
 */
const DOMESTIC_TEST_CARD = "5267318187975449";
const TEST_OTP = "1234";

/** A cake whose "Order cancel" toggle is on, bought and paid for. Returns the order number. */
async function buyAndPay(page: Page, productSlug: string, email: string): Promise<string> {
  await page.goto(`/store/p/${productSlug}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();

  await page.goto("/store/cart");
  await page.getByRole("button", { name: /proceed to checkout/i }).click();
  await expect(page).toHaveURL(/\/store\/checkout/);

  await page.getByLabel(/full name/i).fill("E2E Cancel Probe");
  // Signed in, so the address step says "Ordering as" instead of asking.
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByLabel("Phone", { exact: true }).fill("9000000003");
  await page.getByLabel(/address line 1|address/i).first().fill("3 Probe Lane");
  await page.getByLabel(/city/i).fill(PROBE_ADDRESS.city);
  await page.getByLabel(/state/i).fill(PROBE_ADDRESS.state);
  await page.getByLabel(/PIN code/i).fill(PROBE_ADDRESS.pincode);
  // The map pin decides delivery; a typed PIN alone no longer continues.
  await pinDeliveryDoor(page);
  await page.getByRole("button", { name: /continue|next/i }).first().click();

  // One field and a dialog now: day, delivery type, window.
  await bookDeliverySlot(page);
  await page.getByRole("button", { name: /continue|next/i }).first().click();

  await page.getByText(/pay online/i).first().click();
  const terms = page.locator('label:has(#acceptTerms) [role="checkbox"]');
  await terms.scrollIntoViewIfNeeded();
  await terms.click();
  await page
    .getByRole("button", { name: /^(pay[^a-z]*\d|place order)/i })
    .filter({ hasNotText: /go back|edit/i })
    .first()
    .click();

  const rz = page.frameLocator('iframe[src*="razorpay"]').first();
  const number = rz.getByRole("textbox", { name: /card number/i });
  await expect(number, "the payment window never opened").toBeVisible({ timeout: 45_000 });
  await number.click();
  await number.pressSequentially(DOMESTIC_TEST_CARD, { delay: 60 });
  const expiry = rz.getByRole("textbox", { name: /MM \/ YY/i });
  await expiry.click();
  await expiry.pressSequentially("1230", { delay: 60 });
  const cvv = rz.getByRole("textbox", { name: /CVV/i });
  await cvv.click();
  await cvv.pressSequentially("123", { delay: 60 });
  await rz.getByRole("button", { name: /^continue$/i }).first().click();

  for (let step = 0; step < 14; step += 1) {
    if (/\/store\/order\/success/.test(page.url())) break;
    await page.waitForTimeout(5000);
    const shown = await page
      .locator('iframe[src*="razorpay"]')
      .first()
      .contentFrame()
      ?.locator("body")
      .innerText()
      .catch(() => "");
    if (!shown) continue;
    if (/Enter OTP/i.test(shown)) {
      const otp = rz.getByRole("textbox").last();
      await otp.click().catch(() => undefined);
      await otp.pressSequentially(TEST_OTP, { delay: 80 }).catch(() => undefined);
      await rz.getByRole("button", { name: /^continue$/i }).last().click().catch(() => undefined);
      continue;
    }
    const offer = rz.getByRole("button", { name: /maybe later|skip/i }).first();
    if (await offer.isVisible().catch(() => false)) await offer.click().catch(() => undefined);
  }

  await page.waitForURL(/\/store\/order\/success/, { timeout: 60_000 });
  const placed = new URL(page.url()).searchParams.get("order");
  expect(placed, "the confirmation page names no order").toBeTruthy();
  return placed!;
}

/** The stored order, read straight from the database. */
async function storedOrder(orderNumber: string) {
  const db = await connect();
  const order = await db.collection("orders").findOne({ orderNumber });
  expect(order, `order ${orderNumber} was not stored`).toBeTruthy();
  return order as unknown as {
    _id: string;
    status: string;
    paymentStatus: string;
    preparationStartedAt?: string;
    cancellationPolicy?: { policyClass: string; acceptedAt?: string };
    refundRecord?: {
      status: string;
      gatewayRefunds?: { status: string; testMode?: boolean }[];
    };
  };
}

test.describe("a paid order: cancel, refund, decline", () => {
  test.skip(process.env.E2E_PAY !== "1", "opt-in: set E2E_PAY=1 to drive real Razorpay payments");
  test.describe.configure({ mode: "serial" });

  let customerEmail = "";

  test.afterAll(async () => {
    await removeCustomer(customerEmail);
  });

  test("the customer cancels before the kitchen starts, and the refund goes through", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const available = await page.request.get("/api/razorpay/availability");
    const status = (await available.json()) as { configured?: boolean; testMode?: boolean };
    test.skip(!status.configured, "this shop has no Razorpay keys");
    expect(status.testMode, "REFUSING to drive a payment against LIVE keys").toBe(true);

    customerEmail = await probeEmail("cancel");
    await signInAsCustomer(page, customerEmail);

    const orderNumber = await buyAndPay(page, "butterscotch-crunch", customerEmail);

    const placed = await storedOrder(orderNumber);
    expect(placed.paymentStatus).toBe("paid");
    expect(placed.cancellationPolicy?.policyClass).toBe("made_to_order");
    expect(placed.cancellationPolicy?.acceptedAt, "the terms tick was not recorded").toBeTruthy();

    // ---- the customer cancels from My Orders ----
    await page.goto("/account/orders");
    const cancel = page.getByRole("button", { name: /^cancel order$/i });
    await expect(cancel, "a cancellable, unstarted order offers no Cancel button").toHaveCount(1);
    await cancel.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: new RegExp(orderNumber) })).toBeVisible();
    await dialog.getByRole("button", { name: /^cancel order$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(/refund in progress/i).first()).toBeVisible();

    const cancelled = await storedOrder(orderNumber);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.refundRecord?.status, "cancelling a paid order opened no refund request").toBe(
      "requested",
    );

    // ---- the admin issues the refund ----
    await adminSession(page);
    const refund = await page.request.post(`/api/orders/${cancelled._id}/refund`, {
      data: { reason: "order_cancelled" },
    });
    expect(refund.status(), await refund.text()).toBe(200);

    const refunded = await storedOrder(orderNumber);
    const gateway = refunded.refundRecord?.gatewayRefunds ?? [];
    expect(gateway.length, "no gateway refund was made").toBeGreaterThan(0);
    expect(gateway.every((entry) => entry.testMode)).toBe(true);
    expect(gateway.some((entry) => entry.status === "failed"), "the gateway refused the refund").toBe(
      false,
    );

    // ---- and the customer's page says so ----
    await page.goto(`/store/order/${orderNumber}`);
    await expect(page.getByRole("heading", { name: /cancellation & refund/i })).toBeVisible();
    await expect(page.getByText(/test mode — a simulated refund/i)).toBeVisible();
  });

  test("once the kitchen starts, the customer cannot cancel; a declined refund says declined", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    expect(customerEmail, "the first test did not sign a customer in").toBeTruthy();

    await signInAsCustomer(page, customerEmail);
    const orderNumber = await buyAndPay(page, "pineapple-gateau", customerEmail);
    const placed = await storedOrder(orderNumber);

    // ---- the admin starts preparing it ----
    await adminSession(page);
    if (placed.status === "pending") {
      const confirm = await page.request.patch(`/api/orders/${placed._id}/status`, {
        data: { status: "confirmed" },
      });
      expect(confirm.status(), await confirm.text()).toBe(200);
    }
    const preparing = await page.request.patch(`/api/orders/${placed._id}/status`, {
      data: { status: "preparing" },
    });
    expect(preparing.status(), await preparing.text()).toBe(200);
    expect((await storedOrder(orderNumber)).preparationStartedAt).toBeTruthy();

    // ---- the customer is not offered the button, and the server refuses ----
    await page.goto("/account/orders");
    await expect(page.getByText(orderNumber).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^cancel order$/i })).toHaveCount(0);

    const refused = await page.request.post(
      `/api/customer-auth/orders/${encodeURIComponent(orderNumber)}/cancellation`,
      { data: { reason: "changed my mind" } },
    );
    expect(refused.status(), "the server let a started order be cancelled").toBe(409);
    expect((await storedOrder(orderNumber)).status).toBe("preparing");

    // ---- the admin cancels it, and declines the refund ----
    const cancel = await page.request.post(`/api/orders/${placed._id}/cancel`, {
      data: { cancellationReason: "E2E: cake already baked" },
    });
    expect(cancel.status(), await cancel.text()).toBe(200);
    expect((await storedOrder(orderNumber)).refundRecord?.status).toBe("requested");

    const decline = await page.request.post(`/api/orders/${placed._id}/refund-decline`, {
      data: { reason: "The cake was already made." },
    });
    expect(decline.status(), await decline.text()).toBe(200);

    const declined = await storedOrder(orderNumber);
    expect(declined.status).toBe("cancelled");
    expect(declined.refundRecord?.status).toBe("rejected");
    expect(declined.refundRecord?.gatewayRefunds ?? []).toHaveLength(0);

    await page.goto("/account/orders");
    await expect(page.getByText(/refund declined/i).first()).toBeVisible();
  });
});
