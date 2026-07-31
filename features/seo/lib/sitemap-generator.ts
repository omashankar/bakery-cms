import type { MetadataRoute } from "next";
import { routes } from "@/constants/routes";
import { getGlobalSeo, getSeoRoutes } from "@/features/seo/lib/seo-repository";

export interface SitemapGating {
  /** False hides the wedding-cakes route — it 404s, so advertising it is a lie. */
  weddingEnabled?: boolean;
}

export function buildSitemapEntries(gating: SitemapGating = {}): MetadataRoute.Sitemap {
  const global = getGlobalSeo();
  const base = global.canonicalBaseUrl.replace(/\/$/, "");
  const weddingEnabled = gating.weddingEnabled ?? true;

  return getSeoRoutes()
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

export function getSitemapPreviewCount(): number {
  return buildSitemapEntries().length;
}
