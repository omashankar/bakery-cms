import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect } from "./shop-state";

/**
 * A stat card must not state a number the page has not been given.
 *
 * Every one of these holds its figures back to a zeroed constant until its
 * request settles — which kept the numbers from being WRONG, not from being
 * STATED. So each page opened on a full set of confident zeroes: "Total 0",
 * "Lifetime revenue ₹0.00", and, worst of the family, "0" captioned "All
 * clear" in green on the cards that count work waiting to be done.
 *
 * Reports had the loading gate on three of its seven lists. The other four —
 * top products, top customers, coupons, orders in range — announced "No
 * product sales", "No customer orders", "No coupons used" and "No orders in
 * this range" on every cold load. The fixed twin, four times over in one file.
 *
 * Only a browser can tell the fix from the bug: both branches are in the
 * source either way, and a structural test cannot see which one paints.
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
      document.querySelectorAll("p, h1, h2, span, td").forEach(push);
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

/** Hold a request open long enough to read the page underneath it. */
async function stall(page: Page, pattern: string, ms = 2500): Promise<void> {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

const PAGES = [
  {
    name: "reports",
    path: "/admin/reports",
    stall: "**/api/orders/analytics**",
    settled: /reports/i,
    lies: [
      /₹\s*0\.00/,
      /No product sales/i,
      /No customer orders/i,
      /No coupons used/i,
      /No orders in this range/i,
      /No payment data/i,
    ],
  },
  {
    name: "customers",
    path: "/admin/customers",
    stall: "**/api/customers**",
    settled: /customers/i,
    lies: [/₹\s*0\.00/, /All clear/i],
  },
  {
    // Handled the FAILED aggregation ("—", "Unavailable") and counted "has not
    // answered yet" as success, so a cold load still printed nine zeros.
    name: "orders",
    path: "/admin/orders",
    stall: "**/api/orders/stats**",
    settled: /orders/i,
    lies: [/All clear/i],
  },
  {
    // Handled the FAILED aggregation and counted "has not answered yet" as
    // success — the same gap the orders page had, in three more places.
    name: "refund centre",
    path: "/admin/commerce/payments/refunds",
    stall: "**/api/orders/refund-cases**",
    settled: /refund/i,
    lies: [/All clear/i, /₹\s*0\.00/],
  },
  {
    name: "transactions",
    path: "/admin/commerce/payments/transactions",
    stall: "**/api/payments/transactions**",
    settled: /transaction/i,
    lies: [/₹\s*0\.00/, /all time/i],
  },
  {
    name: "invoices",
    path: "/admin/commerce/invoices",
    stall: "**/api/orders/invoices**",
    settled: /invoice/i,
    lies: [/all time/i],
  },
];

for (const target of PAGES) {
  test(`${target.name} does not state a figure before it has one`, async ({ page }) => {
    const db = await connect();
    expect(
      await db.collection("orders").countDocuments(),
      "no orders in the shop, so zero would be the truth",
    ).toBeGreaterThan(0);

    await adminSession(page);
    await recordText(page);
    await stall(page, target.stall);

    await page.goto(target.path);
    await expect(page.getByRole("heading", { name: target.settled }).first()).toBeVisible();

    const midFlight = await said(page);
    for (const lie of target.lies) {
      expect(midFlight, `${target.name} stated "${lie}" before its request answered`).not.toMatch(
        lie,
      );
    }
  });
}

test("reviews does not offer to add the first review before it has looked", async ({ page }) => {
  // This one is not a figure but the same claim: "No reviews found — Try
  // another filter, or add a review manually", with an Add button, for a shop
  // whose reviews were still being read.
  await adminSession(page);
  await recordText(page);

  await page.goto("/admin/commerce/reviews");
  await expect(page.getByRole("heading", { name: /reviews/i }).first()).toBeVisible();

  const midFlight = await said(page);
  expect(midFlight, "claimed the shop has no reviews before reading them").not.toMatch(
    /No reviews found/i,
  );
});

/*
 * NOT covered here, deliberately: the security centre's four lists.
 *
 * They look like the same bug — "No login history yet." and "No failed
 * attempts." rendered off empty arrays — but each lives in a non-default
 * TabsContent, and the effect that fills them runs on mount. By the time an
 * admin opens any of those tabs the data is already in. A gate was written for
 * them and then removed: reintroducing the bug left every test passing, which
 * is what a fix for an unreachable state looks like.
 */

test("inquiries does not say all clear before it has counted", async ({ page }) => {
  await adminSession(page);
  await recordText(page);

  await page.goto("/admin/inquiries");
  await expect(page.getByRole("heading", { name: /inquiries/i }).first()).toBeVisible();

  const midFlight = await said(page);
  expect(midFlight, "said all clear before counting the inquiries").not.toMatch(/All clear/i);
});
