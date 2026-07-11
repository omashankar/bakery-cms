import type { MetadataRoute } from "next";
import { getGlobalSeo, getSeoRoutes } from "@/features/admin/seo/lib/seo-repository";

export function buildSitemapEntries(): MetadataRoute.Sitemap {
  const global = getGlobalSeo();
  const base = global.canonicalBaseUrl.replace(/\/$/, "");

  return getSeoRoutes()
    .filter((entry) => !entry.noIndex && global.allowIndexing)
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
