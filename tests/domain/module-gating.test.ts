/**
 * Optional modules that hid their UI but left the thing itself running.
 *
 * The Modules page promises "Wedding cakes page, builder, and storefront link".
 * Every LINK obeyed it — the navbar item, the mega menu, the FAQ tab, the search
 * filter, the homepage section, the admin sidebar entry. The page did not:
 * `/store/wedding-cakes` kept returning 200 to anyone holding the URL, the
 * builder that publishes it stayed open, and `sitemap.xml` kept inviting search
 * engines to go and index it. Hidden is not disabled.
 *
 * The route gating itself lives in server components and is verified against a
 * running server; what is pinned here is the part that is pure logic.
 */
import { describe, expect, it } from "vitest";

import { buildSitemapEntries } from "@/features/seo/lib/sitemap-generator";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { seedGlobal } from "@/features/seo/lib/seo-repository";
import { routes } from "@/constants/routes";

describe("the sitemap and a disabled module", () => {
  it("lists the wedding page while the module is on", () => {
    const paths = buildSitemapEntries({ weddingEnabled: true }).map((entry) => entry.url);
    expect(paths.some((url) => url.endsWith(routes.store.weddingCakes))).toBe(true);
  });

  it("drops it once the module is off, because the route now 404s", () => {
    const paths = buildSitemapEntries({ weddingEnabled: false }).map((entry) => entry.url);
    expect(paths.some((url) => url.endsWith(routes.store.weddingCakes))).toBe(false);

    // Only that one route goes; the rest of the sitemap is untouched.
    expect(paths.length).toBe(buildSitemapEntries({ weddingEnabled: true }).length - 1);
  });

  it("defaults to listing it, so a failed settings read never silently deindexes", () => {
    const paths = buildSitemapEntries().map((entry) => entry.url);
    expect(paths.some((url) => url.endsWith(routes.store.weddingCakes))).toBe(true);
  });
});

describe("route titles", () => {
  it("does not let the root template append the site name a second time", () => {
    // `resolveRouteTitle` already appends the SEO title suffix, which carries the
    // shop's name. The root layout's "%s | <site name>" template then ran on top
    // of it and produced "Wedding Cakes | Acme | Acme" in the browser tab.
    //
    // The name comes from the seed rather than a literal: this assertion used to
    // spell the shipped brand out, so renaming that brand made `split(...)` find
    // nothing and report zero occurrences. Zero is not one, so it failed loudly
    // this time — but a guard whose subject can be renamed out from under it is
    // one edit away from passing over the very bug it exists to catch.
    const { siteName } = seedGlobal();
    expect(siteName).not.toBe("");

    const meta = buildRouteMetadata("store-wedding");
    expect(meta.title).toHaveProperty("absolute");

    const { absolute } = meta.title as { absolute: string };
    const occurrences = absolute.split(siteName).length - 1;
    expect(occurrences).toBe(1);
  });

  it("still returns an absolute title for an unknown route key", () => {
    const meta = buildRouteMetadata("no-such-route");
    expect(meta.title).toHaveProperty("absolute");
  });
});
