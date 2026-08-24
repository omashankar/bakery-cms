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
    const profile = source("features/auth/lib/admin-profile.ts");

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
      "features/auth/lib/admin-profile.ts",
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

/** Comments quoting old code are not the code. */
const code = (path: string) =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Whose name heads the admin panel.
 *
 * The sidebar wrote the CMS PRODUCT's name into itself, so every shop's control
 * panel was headed with the vendor's brand instead of the shop's — and because
 * that name carries a trade in it, nine of the ten business types this software
 * runs were headed with a word for a trade they are not in. A florist's admin
 * said "Bakery CMS".
 *
 * The vendor's own pages keep it. They are about the product.
 */
describe("the admin panel's brand", () => {
  const SIDEBAR = "apps/admin/components/admin-sidebar.tsx";
  const BRAND = "components/shared/app-brand.tsx";

  it("names the shop, not the software", () => {
    const sidebar = code(SIDEBAR);
    // Read from settings, and handed to the brand block.
    expect(sidebar).toContain("getGeneralSettings()");
    expect(sidebar).toMatch(/general\.siteName/);
    expect(sidebar).toMatch(/name=\{shopName/);
    // The product's name may not be written into a shop's panel.
    expect(sidebar, "the sidebar hardcodes the product name").not.toContain("Bakery CMS");
  });

  it("does not show the seeded name for a frame before the real one lands", () => {
    // The settings store answers from the shipped seed until the server's copy
    // arrives, so rendering straight away showed the seed and then swapped.
    const sidebar = code(SIDEBAR);
    expect(sidebar).toContain("settingsHydration.hasSettled()");
    expect(sidebar).toMatch(/pending=\{brandPending\}/);

    const brand = code(BRAND);
    // A placeholder, not the name it is about to replace.
    expect(brand).toMatch(/pending \?[\s\S]{0,200}animate-pulse/);
  });

  it("leaves the product's own pages saying the product's name", () => {
    // Passing no `name` takes the component's default, which is the product.
    for (const vendorPage of [
      "features/design-system/design-system-page.tsx",
    ]) {
      const src = code(vendorPage);
      expect(src, `${vendorPage} no longer renders the brand`).toContain("<AppBrand");
      expect(src, `${vendorPage} overrides the product name`).not.toMatch(/<AppBrand[^>]*\bname=/);
    }
    // And the default is still the product, so those pages keep it.
    expect(code(BRAND)).toMatch(/PRODUCT_NAME = "Bakery CMS"/);
    expect(code(BRAND)).toMatch(/name = PRODUCT_NAME/);
  });
});

/**
 * The badge beside the panel's name.
 *
 * A letter is a placeholder for a picture nobody supplied. The shop's FAVICON
 * is the one image it is guaranteed to have made square, and this badge is
 * 32px — the wordmark logo is typically 3:1, which in that box is ten pixels
 * tall and unreadable.
 */
describe("the admin badge", () => {
  const SIDEBAR = "apps/admin/components/admin-sidebar.tsx";
  const BRAND = "components/shared/app-brand.tsx";
  const IMAGE = "components/shared/app-brand-image.tsx";

  it("uses the shop's own square icon, not the logo", () => {
    const sidebar = code(SIDEBAR);
    expect(sidebar).toContain("general.favicon");
    expect(sidebar).toMatch(/image=\{shopIcon/);
    // The wordmark belongs in the storefront header, where it has room.
    expect(sidebar, "the sidebar puts the wide logo in a 32px box").not.toMatch(
      /image=\{[^}]*\blogo\b/,
    );
  });

  it("keeps the letter when no icon has been set", () => {
    const brand = code(BRAND);
    // Both arms present, and the picture only when there is one.
    expect(brand).toMatch(/hasImage \?[\s\S]{0,400}<AppBrandImage/);
    expect(brand).toMatch(/\) : \([\s\S]{0,300}\{letter\}/);
    // The primary fill is the letter's backdrop; it would show through a
    // transparent PNG, so a picture drops it.
    expect(brand).toMatch(/hasImage \? "overflow-hidden" : "bg-primary"/);
  });

  it("falls back to the letter when the icon URL does not load", () => {
    const image = code(IMAGE);
    expect(image).toContain('"use client"');
    expect(image).toContain("setBroken(true)");
    // A 404 that resolves before hydration fires no React event, so the element
    // is asked directly — the same rule the storefront mark follows.
    expect(image).toContain("naturalWidth === 0");
    expect(image).toMatch(/if \(broken\)[\s\S]{0,200}\{letter\}/);
  });

  it("shows no icon on the product's own pages", () => {
    // They pass no image, so the badge stays the product's letter.
    for (const vendorPage of [
      "features/design-system/design-system-page.tsx",
    ]) {
      expect(code(vendorPage)).not.toMatch(/<AppBrand[^>]*\bimage=/);
    }
  });
});

/**
 * A fresh install has chosen nothing, and must not be shown a stock asset as
 * though it had.
 */
describe("the admin badge on a shop that has set nothing", () => {
  it("does not treat the shipped favicon as the shop's own icon", () => {
    // `defaultGeneralSettings.favicon` is "/favicon.ico" — non-empty, and the
    // file behind it is the stock Create Next App icon. So an "is it set?" check
    // can never fail, and a brand-new install put that icon at the top of its
    // own admin instead of falling back to the shop's initial.
    const sidebar = code("apps/admin/components/admin-sidebar.tsx");
    expect(sidebar).toMatch(/setShopIcon\(chosenFavicon\(/);
    expect(sidebar).toContain('from "@/features/settings/lib/settings-utils"');

    // The rule lives beside the default it compares against, so the login
    // screen's badge can apply it too. Pinned there, not here.
    const utils = code("features/settings/lib/settings-utils.ts");
    const fn = utils.slice(utils.indexOf("export function chosenFavicon"));
    expect(fn.slice(0, 400)).toMatch(/trimmed\s*!==\s*defaultGeneralSettings\.favicon/);
  });
});
