/**
 * SEO, Analytics and Custom Code.
 *
 * The worst defect this project has had: every SERVER read of the SEO store
 * answered from a module variable that only client code ever writes — the demo
 * seed. So robots.txt, sitemap.xml and the canonical/title/OG metadata of every
 * storefront page served the seeded values forever, including a canonical base
 * of `https://www.your-bakery.example`, a domain RFC 2606 reserves so that it can
 * never resolve. The sitemap handed to Google pointed at a host that does not
 * exist.
 *
 * Alongside it, two whole screens that stored, validated and summarised their
 * values and emitted none of them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRouteMetadataFrom } from "@/features/seo/lib/seo-metadata";
import { buildSitemapEntriesFrom } from "@/features/seo/lib/sitemap-generator";
import { seedStore } from "@/features/seo/lib/seo-repository";
import type { SeoStore } from "@/types/seo";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/features/settings/server/settings.service");
  vi.doUnmock("@/features/site-layout/server/site-layout.service");
  vi.doUnmock("@/features/admin-config/server/admin-config.service");
});

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** A store that is deliberately NOT the seed. */
function shopStore(): SeoStore {
  const seeded = seedStore();
  return {
    global: { ...seeded.global, canonicalBaseUrl: "https://cakes.test-shop.invalid" },
    routes: seeded.routes.map((route) => ({ ...route, updatedAt: "2020-01-02T03:04:05.000Z" })),
  };
}

describe("the metadata builder", () => {
  it("uses the store it is handed, not a module variable", () => {
    const metadata = buildRouteMetadataFrom(shopStore(), "store-about");
    expect(metadata.alternates?.canonical).toBe("https://cakes.test-shop.invalid/store/about");
    expect(metadata.openGraph?.url).toBe("https://cakes.test-shop.invalid/store/about");
  });

  it("is what the sitemap builder uses too", () => {
    const entries = buildSitemapEntriesFrom(shopStore());
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].url.startsWith("https://cakes.test-shop.invalid")).toBe(true);
    // `lastModified` came from the module-load timestamp of the seed, so every
    // URL claimed to have changed when the process started.
    expect(entries[0].lastModified).toEqual(new Date("2020-01-02T03:04:05.000Z"));
  });
});

describe("the server reads the database", () => {
  async function withStore(store: unknown) {
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async () => store,
    }));
    return import("@/features/seo/server/seo-store.server");
  }

  it("returns what is stored, not the seed", async () => {
    const { getSeoStoreServer } = await withStore(shopStore());
    const loaded = await getSeoStoreServer();
    expect(loaded.global.canonicalBaseUrl).toBe("https://cakes.test-shop.invalid");
  });

  it("merges defaults under a record that predates a field", async () => {
    // `createMongoStore` seeds only an ABSENT collection, so a shop provisioned
    // before a field existed holds `undefined` for it — and `undefined` reaching
    // a metadata builder is worse than a default.
    const { getSeoStoreServer } = await withStore({
      global: { canonicalBaseUrl: "https://cakes.test-shop.invalid" },
      routes: [],
    });
    const loaded = await getSeoStoreServer();

    expect(loaded.global.canonicalBaseUrl).toBe("https://cakes.test-shop.invalid");
    expect(loaded.global.siteName).toBeTruthy();
  });

  it("falls back to the seed when the database is unreachable", async () => {
    const { getSeoStoreServer } = await withStore(null);
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async () => {
        throw new Error("mongo down");
      },
    }));
    const loaded = await getSeoStoreServer();
    // A blip must not take the storefront's metadata down with it.
    expect(loaded.global.siteName).toBeTruthy();
  });
});

describe("robots, sitemap and every storefront page", () => {
  it("read the store on the server", () => {
    const robots = code("app/robots.ts");
    // `getGlobalSeo()` answers from a module variable only client code writes.
    expect(robots).not.toContain("getGlobalSeo");
    expect(robots).toContain("getSeoStoreServer()");
    // Per REQUEST, not once at build. This used to assert only that `robots()`
    // was `async` — which is not a request-time API, so `robots.js` stayed "a
    // special Route Handler that is cached by default" and every crawler read
    // the copy baked at build time. Nothing in the getSeoStoreServer chain
    // touches headers/cookies either, so the opt-out has to be explicit.
    expect(robots).toMatch(/export default async function robots/);
    expect(robots).toContain("await connection();");
    expect(robots).toContain('from "next/server"');

    const sitemap = code("app/sitemap.ts");
    expect(sitemap).toContain("getSeoStoreServer()");
    expect(sitemap).toContain("buildSitemapEntriesFrom(store");
  });

  it("build metadata per request, not once at module load", () => {
    const pages = [
      "app/(storefront)/store/page.tsx",
      "app/(storefront)/store/about/page.tsx",
      "app/(storefront)/store/collections/page.tsx",
      "app/(storefront)/store/contact/page.tsx",
      "app/(storefront)/store/faq/page.tsx",
      "app/(storefront)/store/gallery/page.tsx",
      "app/(storefront)/store/privacy/page.tsx",
      "app/(storefront)/store/search/page.tsx",
      "app/(storefront)/store/terms/page.tsx",
      "app/(storefront)/store/thank-you/page.tsx",
      "app/(storefront)/store/wedding-cakes/page.tsx",
    ];

    for (const page of pages) {
      const rendered = code(page);
      // `export const metadata = buildRouteMetadata(...)` is evaluated once when
      // the module loads, so it could not read a database even if the reader had
      // worked.
      expect(rendered, page).not.toMatch(/export const metadata\s*:\s*Metadata\s*=/);
      expect(rendered, page).toContain("buildRouteMetadataServer(");
    }
  });
});

describe("analytics and custom code reach a visitor", () => {
  async function withConfig(analytics: unknown, customCode: unknown) {
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => ({ analytics }),
    }));
    vi.doMock("@/features/admin-config/server/admin-config.service", () => ({
      getAdminConfig: async () => customCode,
    }));
    return import("@/features/settings/server/storefront-scripts.server");
  }

  it("collects the ids the admin saved", async () => {
    const { getStorefrontScripts } = await withConfig(
      { googleAnalyticsId: "G-ABC123", facebookPixelId: "998877" },
      { css: ".x{}", js: "void 0;" },
    );
    const scripts = await getStorefrontScripts();

    expect(scripts.analytics.googleAnalyticsId).toBe("G-ABC123");
    expect(scripts.analytics.facebookPixelId).toBe("998877");
    expect(scripts.customCss).toBe(".x{}");
    expect(scripts.customJs).toBe("void 0;");
  });

  it("drops an id that is not an id, rather than emitting it", async () => {
    // These are interpolated into a script that runs on every visitor's browser.
    // A malformed value is the difference between "no analytics" and "a broken
    // page", and the schema only constrains future writes.
    const { getStorefrontScripts } = await withConfig(
      { googleAnalyticsId: "G-ABC'; alert(1); //", hotjarId: "<script>" },
      {},
    );
    const scripts = await getStorefrontScripts();

    expect(scripts.analytics.googleAnalyticsId).toBe("");
    expect(scripts.analytics.hotjarId).toBe("");
  });

  it("emits nothing at all when the database is unreachable", async () => {
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => {
        throw new Error("mongo down");
      },
    }));
    vi.doMock("@/features/admin-config/server/admin-config.service", () => ({
      getAdminConfig: async () => ({}),
    }));
    const { getStorefrontScripts } = await import(
      "@/features/settings/server/storefront-scripts.server"
    );
    const scripts = await getStorefrontScripts();

    // A half-written tracker is worse than none.
    expect(scripts.analytics.googleAnalyticsId).toBe("");
    expect(scripts.customJs).toBe("");
  });

  it("renders each tag only when its id is set", () => {
    const tags = code("components/shared/storefront-scripts.tsx");
    expect(tags).toMatch(/\{analytics\.googleAnalyticsId \? \(/);
    expect(tags).toMatch(/\{analytics\.googleTagManagerId \? \(/);
    expect(tags).toMatch(/\{analytics\.facebookPixelId \? \(/);
    expect(tags).toMatch(/\{analytics\.hotjarId \? \(/);
    expect(tags).toMatch(/\{customCss\.trim\(\) \? \(/);
    expect(tags).toMatch(/\{customJs\.trim\(\) \? \(/);
  });

  it("runs on the storefront and NOT in the admin", () => {
    // An admin session can read orders, customers and settings; a script written
    // for the shop's own pages has no business running there.
    const shell = code("layouts/storefront-layout.tsx");
    expect(shell).toContain("<StorefrontScriptTags scripts={scripts} />");

    const adminLayout = code("app/(admin)/layout.tsx");
    expect(adminLayout).not.toContain("StorefrontScriptTags");
  });
});

describe("two fields that were validated and emitted nowhere", () => {
  it("puts the Google verification token in the head", () => {
    const layout = code("app/layout.tsx");
    // A plainly labelled field, saved with "Global SEO settings saved", read by
    // nothing — so a shop pasting Search Console's token stayed unverified.
    expect(layout).toContain("verification: googleSiteVerification");
  });

  it("emits the organisation schema the SEO screen blocks Save over", () => {
    const shell = code("layouts/storefront-layout.tsx");
    // Malformed JSON there blocked the whole section's Save — a gate on a value
    // no search engine was ever shown.
    expect(shell).toContain('type="application/ld+json"');
    expect(shell).toContain("organizationSchema");
  });
});

describe("a refused write", () => {
  it("is rolled back out of the SEO cache", async () => {
    const repo = await import("@/features/seo/lib/seo-repository");
    const { seoHydration } = await import("@/features/site-layout/lib/site-layout-api");
    seoHydration.markSettled();

    const before = repo.loadSeoStore();
    localStorage.setItem("bakery-cms-seo", JSON.stringify(before));
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await repo.saveGlobalSeo({
      ...before.global,
      canonicalBaseUrl: "https://rejected.invalid",
    });

    expect(result.persisted).toBe(false);
    // `upsertSeoRouteForPath` re-sends the whole store whenever a CMS page is
    // published, so a poisoned cache would be pushed again by an unrelated act.
    expect(repo.loadSeoStore().global.canonicalBaseUrl).not.toBe("https://rejected.invalid");
    // And the form is handed what is actually in place, not what was attempted.
    expect(result.value.canonicalBaseUrl).not.toBe("https://rejected.invalid");
  });

  it("is rolled back out of the custom-code cache", async () => {
    const repo = await import("@/features/settings/lib/custom-code-repository");
    const { adminConfigHydration } = await import(
      "@/features/admin-config/lib/admin-config-api"
    );
    adminConfigHydration.markSettled();

    localStorage.setItem(
      "bakery-cms-custom-code",
      JSON.stringify({ css: ".real{}", js: "real();" }),
    );
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    // A refused CLEAR is the sharp case: it left the browser believing the shop
    // had no custom code at all, for the rest of the session.
    const persisted = await repo.saveCustomCode({ css: "", js: "" });

    expect(persisted).toBe(false);
    expect(repo.loadCustomCode().css).toBe(".real{}");
  });
});

describe("what the server accepts", () => {
  it("defaults the SEO route fields the screen and the sitemap read", async () => {
    const { siteLayoutSchemas } = await import(
      "@/features/site-layout/server/site-layout.validators"
    );

    // The SEO table sorts on `label.localeCompare(...)` and the sitemap stamps
    // `lastModified` from `updatedAt`; neither was constrained, so a restored
    // backup missing them threw on that screen and produced Invalid Dates.
    const parsed = siteLayoutSchemas.seo.parse({
      global: { siteName: "A Bakery" },
      routes: [{ id: "r1", routeKey: "store-about", path: "/store/about" }],
    });

    expect(parsed.routes[0].label).toBe("");
    expect(parsed.routes[0].noIndex).toBe(false);
    expect(Number.isNaN(new Date(parsed.routes[0].updatedAt).getTime())).toBe(false);
  });
});
