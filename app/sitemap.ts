import type { MetadataRoute } from "next";
import { buildSitemapEntriesFrom } from "@/features/seo/lib/sitemap-generator";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";
import { isWeddingEnabledOnServer } from "@/features/settings/server/modules.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The wedding-cakes route 404s once the Wedding module is off, so it must not
  // be listed here — a sitemap entry is an instruction to go and crawl it.
  // From MongoDB. The builder used to read a module variable that only
  // client code writes, so this served the demo seed to every crawler.
  const [store, weddingEnabled] = await Promise.all([
    getSeoStoreServer(),
    isWeddingEnabledOnServer(),
  ]);
  return buildSitemapEntriesFrom(store, { weddingEnabled });
}
