import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect } from "./shop-state";

/**
 * The dashboard must not report the shop's takings before it has them.
 *
 * Every commerce figure starts at `EMPTY_DASHBOARD_COMMERCE_ANALYTICS`, and
 * until the analytics request answered the page rendered that as fact: Revenue
 * ₹0.00, Orders 0, "Active orders 0" captioned "All clear" in green, plus "No
 * orders yet", "No payment data in this period." and "No sales yet". The
 * caption underneath already knew how to say "Figures unavailable", but only
 * after a FAILURE — while the first request was merely in flight it said
 * nothing, so eight zeroes stood unqualified on every cold load.
 *
 * "All clear" is the dangerous one. It is the sentence that tells a baker
 * nothing is waiting to be made.
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
      document.querySelectorAll("p, h1, h2, span").forEach(push);
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

test("does not report zero revenue, or all clear, before the figures arrive", async ({ page }) => {
  const db = await connect();
  const orderCount = await db.collection("orders").countDocuments();
  expect(orderCount, "no orders in the shop, so zero would be the truth").toBeGreaterThan(0);

  await adminSession(page);
  await recordText(page);

  // Hold the aggregation open long enough to read what is underneath it.
  await page.route("**/api/orders/analytics**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.goto("/admin/dashboard");

  // Mid-flight: it must say it is loading, not that the shop earned nothing.
  await expect(page.getByText(/loading figures/i)).toBeVisible();

  const midFlight = await said(page);
  // The side panels read their data synchronously, but `useEffect` runs after
  // the browser paints — so they each had a real frame of the same claim. The
  // recorder above catches exactly that frame.
  for (const lie of [
    /₹\s*0\.00/,
    /All clear/i,
    /No orders yet/i,
    /No sales( data)? yet/i,
    /No payment data/i,
    /No inquiries yet/i,
    /No recent activity yet/i,
  ]) {
    expect(midFlight, `stated "${lie}" before the analytics answered`).not.toMatch(lie);
  }

  // Then the real figures land.
  await expect(page.getByText(/loading figures/i)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: /revenue/i }).first()).toBeVisible();

  const whole = await said(page);
  expect(whole, "reported zero revenue at some point before the figures arrived").not.toMatch(
    /₹\s*0\.00/,
  );
});

test("still reports a genuine zero once the figures are in", async ({ page }) => {
  // The other half. Suppressing the empty state while loading must not suppress
  // it for a shop that really has taken nothing in the range.
  await adminSession(page);

  // Empty out the REAL response rather than inventing one: a hand-written
  // payload that fails to parse would land on the failure path instead, and
  // pass this test for entirely the wrong reason. (It did, the first time.)
  // Built once and replayed: the dashboard re-requests on order events, and a
  // second `route.fetch()` reads a response Playwright has already disposed.
  let zeroed: unknown = null;
  await page.route("**/api/orders/analytics**", async (route) => {
    if (!zeroed) {
      const response = await route.fetch();
      const json = (await response.json()) as {
        data: { summary: Record<string, number> } & Record<string, unknown>;
      };
      zeroed = {
        ...json,
        data: {
          ...json.data,
          summary: Object.fromEntries(Object.keys(json.data.summary).map((key) => [key, 0])),
          statusBreakdown: [],
          paymentBreakdown: [],
          topProducts: [],
          trend: [],
        },
      };
    }
    await route.fulfill({ json: zeroed });
  });

  await page.goto("/admin/dashboard");

  await expect(page.getByText("All clear")).toBeVisible();
  await expect(page.getByText("No sales data yet")).toBeVisible();
  await expect(page.getByText("No sales yet")).toBeVisible();
  await expect(page.getByText(/loading figures/i)).toHaveCount(0);
  await expect(page.getByText(/figures unavailable/i)).toHaveCount(0);
});

test("says the figures are unavailable rather than zero when the request fails", async ({
  page,
}) => {
  // The third state. A failed cold load left every zero standing and disclaimed
  // them in a caption below — so "Active orders 0 — All clear" sat in confident
  // green underneath "Figures unavailable — the server did not answer".
  await adminSession(page);
  await page.route("**/api/orders/analytics**", (route) => route.fulfill({ status: 500 }));

  await page.goto("/admin/dashboard");

  await expect(page.getByText(/figures unavailable — the server did not answer/i)).toBeVisible();
  await expect(page.getByText("All clear")).toHaveCount(0);
  await expect(page.getByText(/₹\s*0\.00/)).toHaveCount(0);
  await expect(page.getByText("No sales data yet")).toHaveCount(0);
  // And it must not sit in a permanent loading state either.
  await expect(page.getByText(/loading figures/i)).toHaveCount(0);
});
