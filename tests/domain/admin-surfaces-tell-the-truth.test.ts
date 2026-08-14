import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { toDashboardCommerceAnalytics } from "@/apps/admin/dashboard/lib/dashboard-analytics";
import type { OrderAnalyticsResponse } from "@/features/orders/lib/orders-api";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * "All time" has no prior period. `getAnalyticsWindow` returns
 * `previousStart: null` for it, so `previousSummary` is all zeros — and
 * `formatDashboardDelta` reads a zero previous as "New vs prior period" and
 * paints it green. Every all-time dashboard claimed growth against a period
 * that does not exist, on the shop's revenue and its order count.
 */
describe("the dashboard's comparison line", () => {
  const response = (revenue: number, previous: number) =>
    ({
      summary: { revenue, orders: 5, averageOrderValue: 100 },
      previousSummary: { revenue: previous, orders: 0, averageOrderValue: 0 },
      trend: [],
      statusBreakdown: [],
      paymentBreakdown: [],
      topProducts: [],
      recentOrders: [],
    }) as unknown as OrderAnalyticsResponse;

  it("says nothing about growth on All time", () => {
    const all = toDashboardCommerceAnalytics("all", response(1000, 0));

    expect(all.revenueDelta).toEqual({ label: "All-time total", tone: "neutral" });
    expect(all.ordersDelta).toEqual({ label: "All-time total", tone: "neutral" });
    expect(all.aovDelta.tone).toBe("neutral");
  });

  it("still compares on a range that HAS a prior period", () => {
    const month = toDashboardCommerceAnalytics("30d", response(1000, 500));

    expect(month.revenueDelta.label).toContain("%");
    expect(month.revenueDelta.tone).toBe("positive");
  });

  it("distinguishes 'nothing loaded' from 'the last refresh failed'", () => {
    const page = source("apps/admin/dashboard/dashboard-page.tsx");

    // Captioning perfectly good figures "Figures unavailable" is the same wrong
    // statement as showing zero without one. Both were fixed in reports-page
    // and left here, along with the retry.
    expect(page).toContain("Showing the last figures — the server did not answer");
    expect(page).toContain("Figures unavailable — the server did not answer");
    expect(page).toContain("MAX_REFRESH_RETRIES");
    expect(page).toContain("if (retry !== undefined) clearTimeout(retry);");
  });
});

/**
 * The server's overview drops archived products and counts a low/empty product
 * as an ALERT only when it is published — a draft cannot be oversold. The
 * browser twin, which the Dashboard strip and the sidebar badge read, counted
 * the whole catalogue.
 */
describe("the stock alert count", () => {
  it("uses the server's two rules", () => {
    const repo = source("apps/admin/commerce/lib/inventory-repository.ts");
    const overview = repo.slice(repo.indexOf("export function getInventoryOverview"));
    const body = overview.slice(0, overview.indexOf("\n}"));

    expect(body).toContain('status !== "archived"');
    expect(body).toContain('status === "published"');
  });
});

/**
 * Everything below is a screen stating something it did not know.
 */
describe("what the admin screens claim", () => {
  it("counts a gateway as live at checkout only once the connection is known", () => {
    const page = source("apps/admin/commerce/pages/gateway-manager-page.tsx");

    // `runtime.enabled` for Razorpay is `commerce.paymentMethods.razorpay`,
    // which defaults to true — so a shop with no keys read "Online 1 · live at
    // checkout" while checkout offered Cash on Delivery only.
    expect(page).toContain("const isLiveAtCheckout =");
    expect(page).toContain('return razorpayStatus === "connected";');
    expect(page).toContain("const countsReady = mounted && razorpayStatus !== null;");
  });

  it("does not print money as collected that was never collected", () => {
    const dialog = source("apps/admin/commerce/components/transaction-detail-dialog.tsx");

    expect(dialog).toContain('label="Order total"');
    expect(dialog).toContain('label="Collected"');
    expect(dialog).toContain("isCollectedMoney(order) ? Math.max(0, t.total - refunded) : 0");
    expect(dialog).not.toContain('label="Total paid"');
  });

  it("keeps the account menu on the name the admin actually chose", () => {
    const header = source("apps/admin/components/admin-header.tsx");

    expect(header).toContain("window.addEventListener(ADMIN_PROFILE_UPDATED_EVENT, sync)");
    expect(header).toContain("window.removeEventListener(ADMIN_PROFILE_UPDATED_EVENT, sync)");
  });

  it("lets a printed invoice off the admin shell's clipping box", () => {
    const css = source("app/globals.css");
    const print = css.slice(css.indexOf("@media print"));

    expect(print).toContain("overflow: visible !important;");
    expect(print).toContain("height: auto !important;");
  });
});

/**
 * The profile screen invented its own identity: a hardcoded personal email as
 * the fallback, and seeded created / last-login dates written into the same blob
 * `saveAdminProfile` pushes — so the next save sent them to the server as fact.
 */
describe("whose account the profile screen is showing", () => {
  it("takes the account fields from the server, not from a guess", () => {
    const profile = source("apps/admin/profile/lib/admin-profile.ts");

    expect(profile).toContain("export function persistServerAccount");
    expect(profile).toContain('const ACCOUNT_KEY = "bakery-cms-admin-account"');
    // Blank until the server answers, which the screen renders as an em dash.
    expect(profile).toContain('lastLogin: account.lastLogin ?? ""');
    expect(profile).toContain('createdAt: account.createdAt ?? ""');
    // The seed write that pushed invented dates back.
    expect(profile).not.toContain("Seed created/last-login once");
  });

  it("ships no real person's address as a form default anywhere in auth", () => {
    for (const path of [
      "apps/admin/profile/lib/admin-profile.ts",
      "features/auth/pages/login-form-page.tsx",
      "features/auth/pages/forgot-password-form-page.tsx",
    ]) {
      // The forgot-password page is public and one click from sending mail.
      expect(source(path), path).not.toContain("sumanom7014106@gmail.com");
    }
  });

  it("gives the test email its own plain-text body", () => {
    const service = source("features/communications/server/communications.service.ts");
    const fn = service.slice(service.indexOf("export async function sendTemplateTest"));

    // Derived from the HTML, the text alternative carried the hidden preheader
    // padding — a wall of `&#847;&zwnj;&nbsp;` no real send contains.
    expect(fn).toContain("const body = renderTemplate(template.body, sample);");
    expect(fn).toContain("text: body,");
  });
});
