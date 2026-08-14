import { beforeEach, describe, expect, it, vi } from "vitest";

import { siteLayoutSchemas } from "@/features/site-layout/server/site-layout.validators";
import { seedGlobal } from "@/features/seo/lib/seo-repository";

/**
 * Two GLOBAL SEO fields had the problem the ROUTE fields beside them were fixed
 * for: unvalidated, and read by code that assumes a type.
 *
 *  - `canonicalBaseUrl` is `.replace(/\/$/, "")`d by three consumers with no
 *    guard — robots.txt, the sitemap generator and the metadata builder. Stored
 *    as `null`, robots.txt and sitemap.xml both answered 500. (`email.service`
 *    reads the same field with `?.trim()` and a fallback: one careful consumer,
 *    three that assume.)
 *  - `allowIndexing` is read as `if (!global.allowIndexing)`. Stored as `null`,
 *    robots.txt served `Disallow: /` — the shop withdrawn from every search
 *    engine, silently, with no error anywhere.
 *
 * Both confirmed live, and reachable the same way the route fields were: the
 * backup restore posts a hand-editable JSON file straight to this endpoint.
 */
const parse = (global: unknown) =>
  siteLayoutSchemas.seo.safeParse({ global, routes: [] });

describe("what the SEO endpoint will store", () => {
  it("refuses a canonical base that is not a string", () => {
    expect(parse({ siteName: "Shop", canonicalBaseUrl: null }).success).toBe(false);
    expect(parse({ siteName: "Shop", canonicalBaseUrl: 42 }).success).toBe(false);
    expect(parse({ siteName: "Shop", canonicalBaseUrl: {} }).success).toBe(false);
  });

  it("refuses an address a crawler cannot use", () => {
    // The ordinary thing to type, and it produces `Sitemap: monginis.com/sitemap.xml`
    // — broken in a way nobody sees.
    expect(parse({ siteName: "Shop", canonicalBaseUrl: "monginis.com" }).success).toBe(false);
    expect(parse({ siteName: "Shop", canonicalBaseUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(parse({ siteName: "Shop", canonicalBaseUrl: "ftp://shop.test" }).success).toBe(false);
  });

  it("accepts a real one, and an empty one", () => {
    expect(parse({ siteName: "Shop", canonicalBaseUrl: "https://cakes.example" }).success).toBe(
      true,
    );
    expect(parse({ siteName: "Shop", canonicalBaseUrl: "http://localhost:3000" }).success).toBe(
      true,
    );
    // Blank is a shop that has not set one yet, not a malformed value.
    expect(parse({ siteName: "Shop", canonicalBaseUrl: "" }).success).toBe(true);
  });

  it("refuses an indexing flag that is not a boolean, and defaults it to on", () => {
    expect(parse({ siteName: "Shop", allowIndexing: null }).success).toBe(false);
    expect(parse({ siteName: "Shop", allowIndexing: "false" }).success).toBe(false);

    const parsed = parse({ siteName: "Shop" });
    expect(parsed.success && parsed.data.global.allowIndexing).toBe(true);
  });

  it("still honours a deliberate false", () => {
    const parsed = parse({ siteName: "Shop", allowIndexing: false });
    expect(parsed.success && parsed.data.global.allowIndexing).toBe(false);
  });
});

/**
 * A schema only constrains FUTURE writes. This is the path a document already at
 * rest goes through — which is where the 500 actually came from.
 */
const layout = vi.hoisted(() => ({ seo: null as unknown }));
vi.mock("@/features/site-layout/server/site-layout.service", () => ({
  getSiteLayout: vi.fn(async () => layout.seo),
}));

const { getSeoStoreServer } = await import("@/features/seo/server/seo-store.server");

describe("what a document already in the database is read as", () => {
  beforeEach(() => {
    layout.seo = null;
  });

  it("replaces a canonical base of the wrong type with the seeded one", async () => {
    layout.seo = { global: { siteName: "Shop", canonicalBaseUrl: null }, routes: [] };

    const store = await getSeoStoreServer();

    expect(store.global.canonicalBaseUrl).toBe(seedGlobal().canonicalBaseUrl);
    // The three consumers call this. It has to be a string or they throw.
    expect(() => store.global.canonicalBaseUrl.replace(/\/$/, "")).not.toThrow();
  });

  it("replaces a blank canonical base too, since a relative sitemap line is unusable", async () => {
    layout.seo = { global: { siteName: "Shop", canonicalBaseUrl: "   " }, routes: [] };

    expect((await getSeoStoreServer()).global.canonicalBaseUrl).toBe(
      seedGlobal().canonicalBaseUrl,
    );
  });

  it("does not read a non-boolean indexing flag as 'withdraw the site'", async () => {
    layout.seo = { global: { siteName: "Shop", allowIndexing: null }, routes: [] };

    expect((await getSeoStoreServer()).global.allowIndexing).toBe(true);
  });

  it("still reads a genuine false as false", async () => {
    layout.seo = { global: { siteName: "Shop", allowIndexing: false }, routes: [] };

    // The fix must not swallow the setting it is protecting.
    expect((await getSeoStoreServer()).global.allowIndexing).toBe(false);
  });

  it("leaves a good document exactly as it is", async () => {
    layout.seo = {
      global: { siteName: "Shop", canonicalBaseUrl: "https://cakes.example", allowIndexing: true },
      routes: [],
    };

    const store = await getSeoStoreServer();
    expect(store.global.canonicalBaseUrl).toBe("https://cakes.example");
    expect(store.global.siteName).toBe("Shop");
  });
});
