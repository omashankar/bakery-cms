import type { MetadataRoute } from "next";
import { routes } from "@/constants/routes";
import { getGlobalSeo, getSeoRoutes } from "@/features/seo/lib/seo-repository";
import type { SeoStore } from "@/types/seo";

export interface SitemapGating {
  /** False hides the wedding-cakes route — it 404s, so advertising it is a lie. */
  weddingEnabled?: boolean;
}

/**
 * Built from a store handed in, so the SERVER can pass the real one.
 *
 * This read `getGlobalSeo()`/`getSeoRoutes()`, which on the server answer
 * from a module variable only client code writes — so every URL in the
 * sitemap carried the seeded `https://www.monginis.example` base, and each
 * `lastModified` was the moment the module happened to load.
 */
export function buildSitemapEntriesFrom(
  store: SeoStore,
  gating: SitemapGating = {},
): MetadataRoute.Sitemap {
  const global = store.global;
  const base = global.canonicalBaseUrl.replace(/\/$/, "");
  const weddingEnabled = gating.weddingEnabled ?? true;

  return store.routes
    .filter((entry) => !entry.noIndex && global.allowIndexing)
    // A route the Wedding module has closed now returns 404. Leaving it in the
    // sitemap asks search engines to crawl a page the shop deliberately removed.
    .filter((entry) => weddingEnabled || entry.path !== routes.store.weddingCakes)
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
