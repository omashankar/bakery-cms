import type { MetadataRoute } from "next";
import { getGlobalSeo, getSeoRoutes } from "@/features/seo/lib/seo-repository";
import type { SeoStore } from "@/types/seo";

export interface SitemapGating {
  /**
   * Read by nothing since the wedding-cakes page itself was removed
   * (05ec3249); kept so existing callers still type-check.
   */
  weddingEnabled?: boolean;
}

/**
 * Built from a store handed in, so the SERVER can pass the real one.
 *
 * This read `getGlobalSeo()`/`getSeoRoutes()`, which on the server answer
 * from a module variable only client code writes — so every URL in the
 * sitemap carried the seeded `https://www.your-bakery.example` base, and each
 * `lastModified` was the moment the module happened to load.
 */
export function buildSitemapEntriesFrom(
  store: SeoStore,
  _gating: SitemapGating = {},
): MetadataRoute.Sitemap {
  const global = store.global;
  const base = global.canonicalBaseUrl.replace(/\/$/, "");

  return store.routes
    .filter((entry) => !entry.noIndex && global.allowIndexing)

    .map((entry) => ({
      url: `${base}${entry.path}`,
      lastModified: new Date(entry.updatedAt),
      changeFrequency: entry.path.includes("/store") ? "daily" : "weekly",
      priority: entry.path === "/store" ? 1 : entry.path.endsWith("/store") ? 0.9 : 0.7,
    }));
}

/** The client-side wrapper, for the admin's own preview count. */
export function buildSitemapEntries(gating: SitemapGating = {}): MetadataRoute.Sitemap {
  return buildSitemapEntriesFrom(
    { global: getGlobalSeo(), routes: getSeoRoutes() },
    gating,
  );
}

export function getSitemapPreviewCount(): number {
  return buildSitemapEntries().length;
}
