import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Comments quoting old code are not the code. */
const code = (path: string) =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Two brands live in this repo, and each belongs on its own pages.
 *
 * The PRODUCT ("Bakery CMS") is the software, sold to shop owners. It belongs on
 * the vendor's surfaces: /platform, /platform/docs, /design-system. The SHOP is
 * whoever installed it, and it belongs on everything a customer sees plus the
 * owner's admin.
 *
 * The leak ran in both directions. The root layout builds the tab from the
 * SHOP's settings, so the vendor's own sales page served a client bakery's
 * favicon and its design system titled itself after that bakery. And the
 * storefront footer credited the vendor on every customer page, checkout
 * included, while the 404 handed customers buttons into the vendor's internals.
 */

/** Every route that is about the software rather than about a shop. */
const VENDOR_ROUTES = [
  "app/platform/page.tsx",
  "app/platform/docs/page.tsx",
  "app/design-system/page.tsx",
];

describe("the vendor's own pages", () => {
  it("each set their own icon instead of inheriting the shop's", () => {
    // `app/layout.tsx` is the only place that sets `icons`, and it sets the
    // SHOP's favicon. A vendor route that does not override it serves a client
    // bakery's logo in the browser tab — verified live on /platform before this.
    for (const route of VENDOR_ROUTES) {
      const src = code(route);
      // The SPREAD, not the token. `toContain("PRODUCT_METADATA")` was also
      // satisfied by the import line, so deleting the spread and leaving the
      // import passed — the assertion could not fail the one way it mattered.
      expect(src, `${route} imports the product metadata but never spreads it`).toMatch(
        /\.\.\.PRODUCT_METADATA/,
      );
      expect(src).toContain('from "@/constants/product-brand"');
    }
  });

  it("each state an ABSOLUTE title, so the shop's name is not appended", () => {
    // The root template is `%s | <shop name>`. A plain-string title re-enters
    // it: `title: "Design System"` became "Design System | Sweet Crumbs Bakery".
    for (const route of VENDOR_ROUTES) {
      const src = code(route);
      expect(src, `${route} uses a plain-string title`).toMatch(/title:\s*\{\s*absolute:/);
    }
  });

  it("ships the product icon the routes point at", () => {
    const icon = code("constants/product-brand.ts").match(/icon:\s*"([^"]+)"/)?.[1];
    expect(icon, "no product icon path declared").toBeTruthy();
    expect(
      existsSync(join(process.cwd(), "public", icon!.replace(/^\//, ""))),
      `${icon} is declared but not in public/`,
    ).toBe(true);
  });

  it("keeps the design system out of search results", () => {
    // Public and unauthenticated, on whatever domain the shop runs. It stayed
    // out of Google only because the shop's SEO store has indexing off
    // site-wide; the day a shop turns that on, this would go in with it.
    expect(code("app/design-system/page.tsx")).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("prints no real person's address in its sample data", () => {
    // The owner's personal Gmail was a form `defaultValue` and a fake user row
    // on a page anyone could open.
    const ds = source("features/design-system/design-system-page.tsx");
    expect(ds).not.toMatch(/@gmail\.com/);
    expect(ds).not.toMatch(/sumanom/i);
  });
});

describe("the customer's pages", () => {
  it("do not advertise the shop's software supplier", () => {
    // This footer is on every storefront and account page, checkout included.
    // The credit named the vendor to cake buyers, and its link pointed at `/`,
    // which redirects back to /store — so the one reader it was for could never
    // follow it anywhere.
    const footer = code("apps/website/landing/components/landing-footer.tsx");
    expect(footer).not.toContain("Powered by");
    expect(footer).not.toContain("Bakery CMS");
    expect(footer, "the public footer links to the staff login").not.toContain(
      "routes.auth.login",
    );
  });

  it("answer a bad URL with the shop's 404, not a build-status card", () => {
    // `RoutePlaceholder` gave customers a construction-cone icon, a "Phase 4"
    // badge and two buttons — "Architecture Hub" and "Design System" — into the
    // vendor's internals, outside the storefront shell so there was no navbar
    // or footer to leave by.
    const notFound = code("app/not-found.tsx");
    expect(notFound).toContain("StoreNotFoundPage");
    expect(notFound).not.toContain("RoutePlaceholder");
    expect(
      existsSync(join(process.cwd(), "components/shared/route-placeholder.tsx")),
      "route-placeholder.tsx is back; it had exactly one caller",
    ).toBe(false);
  });

  it("head the sign-in screens with the shop, not the software", () => {
    // /login, /otp, /forgot-password, /reset-password and the three /auth/*
    // outcomes all render this shell. It said "Bakery CMS" three times under a
    // tab that already read the shop's name.
    const shell = code("layouts/auth-layout.tsx");
    expect(shell).not.toContain("Bakery CMS");
    expect(shell).toMatch(/siteName/);

    const route = code("app/(auth)/layout.tsx");
    expect(route).toContain("getSiteIdentity");
    expect(route).toMatch(/siteName=\{/);
  });
});

describe("a failed settings read", () => {
  it("states no name at all rather than the shipped seed", () => {
    // `resolved: false` means the database could not be reached and the identity
    // is the placeholder — so every page titled itself "Your Bakery" during an
    // outage. The same flag was already honoured for currency and timezone.
    const layout = code("app/layout.tsx");
    // The identity block is CONDITIONAL on `resolved`, and its else is empty —
    // that empty branch is the whole fix, so it is what gets pinned. Scoped to
    // the declaration so a `: {}` anywhere else in the file cannot satisfy it.
    const identity = layout.slice(
      layout.indexOf("const identity"),
      layout.indexOf("return {", layout.indexOf("const identity")),
    );
    expect(identity, "the identity block moved").not.toBe("");
    expect(identity).toMatch(/resolved\s*\?/);
    expect(identity, "an unresolved read still publishes a name").toContain(": {}");
    // And it is the real fields that sit inside the resolved branch.
    expect(identity).toContain("icons: { icon: favicon }");
    expect(identity).toContain("template: `%s | ${siteName}`");
  });

  it("does not canonicalise the storefront to a domain that cannot resolve", () => {
    // The SEO store returned its SEED whole on a read failure, which pointed
    // every canonical at `https://www.your-bakery.example` — a host RFC 2606
    // guarantees never resolves. A canonical is the one metadata error a crawler
    // acts on.
    const store = code("features/seo/server/seo-store.server.ts");
    expect(store).toContain("blankBrand");
    const fn = store.slice(store.indexOf("function blankBrand"));
    for (const field of ["siteName", "titleSuffix", "canonicalBaseUrl"]) {
      expect(fn, `blankBrand leaves ${field} set`).toMatch(
        new RegExp(`${field}:\\s*""`),
      );
    }

    // And the builder omits them rather than emitting empties.
    const meta = code("features/seo/lib/seo-metadata.ts");
    expect(meta).toMatch(/title\.trim\(\)\s*\?/);
    expect(meta).toContain("canonical ? { canonical } : undefined");
  });
});

/**
 * The sign-in screens carry a mark too, and the shop has two different images.
 */
describe("the brand on the sign-in screens", () => {
  const SHELL = "layouts/auth-layout.tsx";

  it("lets the shop's wordmark replace both the badge and the heading", () => {
    // A wordmark IS the name drawn, so printing the name beside it says it
    // twice — the same rule the storefront header and footer follow. Both the
    // desktop plane and the mobile row get it.
    const shell = code(SHELL);
    expect(shell).toMatch(/wordmark\s*\?/);
    // The heading is suppressed under a wordmark.
    expect(shell).toMatch(/wordmark\s*\?\s*null\s*:\s*\(/);
    // Bounded height, free width, capped — not a square.
    const marks = shell.match(/h-\d+ w-auto max-w-\[\d+px\] object-contain/g) ?? [];
    expect(marks.length, "expected a wordmark class on both the plane and the row").toBe(2);
  });

  it("uses the square favicon for the badge, never the wordmark", () => {
    // A 3:1 wordmark in a 48px box is 48x15px. The favicon is the one image a
    // shop is guaranteed to have made square.
    const shell = code(SHELL);
    const badge = shell.slice(shell.indexOf("function BrandBadge"));
    expect(badge.slice(0, 700)).toMatch(/icon\s*\?/);
    expect(badge.slice(0, 700)).not.toMatch(/wordmark/);
  });

  it("does not put the shipped stock icon in a fresh install's badge", () => {
    // `defaultGeneralSettings.favicon` is `/favicon.ico` and non-empty, so an
    // "is it set?" check cannot fail. The browser tab is the one place that
    // default is right; a badge drawing it as THE SHOP'S mark is not.
    const route = code("app/(auth)/layout.tsx");
    expect(route).toContain("chosenFavicon");
    expect(route).toMatch(/favicon=\{[^}]*chosenFavicon/);

    // And the rule itself compares against the shipped value.
    const utils = code("features/settings/lib/settings-utils.ts");
    const fn = utils.slice(utils.indexOf("export function chosenFavicon"));
    expect(fn.slice(0, 400)).toMatch(/!==\s*defaultGeneralSettings\.favicon/);
  });

  it("says nothing at all when the settings read failed", () => {
    // Half an identity — a logo with no name — is worse than none.
    const route = code("app/(auth)/layout.tsx");
    for (const prop of ["siteName", "logo", "favicon"]) {
      expect(route, `${prop} is passed without checking resolved`).toMatch(
        new RegExp(`${prop}=\{resolved \?`),
      );
    }
  });
});
