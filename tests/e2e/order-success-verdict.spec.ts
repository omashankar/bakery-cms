import { expect, test, type Page } from "@playwright/test";

import { connect } from "./shop-state";

/**
 * The success page must not deny an order it has not finished looking for.
 *
 * `order` was null for three different reasons and the screen treated all of
 * them as "no such order": nothing looked up yet, the server still answering,
 * or genuinely absent. Only the h2 knew — the green tick above it, the page
 * title "Order Confirmed" and "Thank you for your order. We're preparing your
 * cakes with care." all celebrated regardless. So a customer whose payment had
 * just cleared could be shown a success tick over "We could not find that
 * order", and stayed on it for as long as the lookup took.
 *
 * Only a browser can tell the fix from the bug: both branches are in the source
 * either way, and a structural test cannot see which one paints.
 */

/** Everything the page said, from the first paint onwards. */
async function recordText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    const push = (node: Node) => {
      const text = (node as HTMLElement).textContent?.trim();
      if (text) w.__said.push(text);
    };
    const start = () => {
      document.querySelectorAll("h1, h2, p").forEach(push);
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) push(node);
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start);
  });
}

const said = (page: Page) =>
  page.evaluate(() => (window as unknown as { __said: string[] }).__said.join("\n"));

test("does not claim an order is missing while it is still looking", async ({ page }) => {
  const db = await connect();
  const order = await db.collection("orders").findOne({});
  expect(order, "no order in the database to open the success page with").toBeTruthy();
  const orderNumber = String(order!.orderNumber);
  const email = String(order!.address?.email ?? order!.email ?? "");
  expect(email, "the seeded order has no email to look it up with").toBeTruthy();

  await recordText(page);

  // Hold the lookup open long enough to read the screen underneath it. This is
  // the window a real customer sits in on a slow connection.
  await page.route("**/api/orders/by-number/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });

  // Arrive the way a customer on another device does: nothing in local storage,
  // so the server is the only source and the wait is unavoidable.
  // The lookup email the track-order form leaves behind — session-scoped, on
  // this device, exactly as `grantOrderAccess` writes it.
  await page.goto(`/store/order/success?order=${encodeURIComponent(orderNumber)}`);
  await page.evaluate(
    ([number, mail]) => {
      window.sessionStorage.setItem(`bakery-cms-verified-orders:lookup:${number}`, mail);
    },
    [orderNumber, email] as const,
  );
  await page.reload();

  // Mid-flight: it must be honest about not knowing yet.
  await expect(page.getByRole("heading", { name: /checking your order/i })).toBeVisible();
  const midFlight = await said(page);
  expect(midFlight, "denied the order before the lookup answered").not.toMatch(
    /could not (find|load) that order/i,
  );

  // And it must not be wearing the success tick while it says that.
  await expect(page.locator(".text-green-600")).toHaveCount(0);

  // Then it resolves to the truth.
  await expect(page.getByRole("heading", { name: /thank you for your order/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".text-green-600")).toHaveCount(1);
  await expect(page.getByText(orderNumber)).toBeVisible();

  const whole = await said(page);
  expect(whole, "denied the order at some point before finding it").not.toMatch(
    /could not (find|load) that order/i,
  );
});

test("says so plainly when the order really is not there, without a success tick", async ({
  page,
}) => {
  // The other half. A genuine miss must still be reported — and reported as a
  // miss, not decorated as a confirmation.
  await page.goto("/store/order/success?order=BK-DOES-NOT-EXIST");

  await expect(page.getByRole("heading", { name: /could not load that order/i })).toBeVisible();
  await expect(page.locator(".text-green-600")).toHaveCount(0);
  await expect(page.getByText(/thank you for your order/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^track order$/i })).toBeVisible();
});
