import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/features/seo/lib/sitemap-generator";
import { isWeddingEnabledOnServer } from "@/features/settings/server/modules.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The wedding-cakes route 404s once the Wedding module is off, so it must not
  // be listed here — a sitemap entry is an instruction to go and crawl it.
  return buildSitemapEntries({ weddingEnabled: await isWeddingEnabledOnServer() });
}
