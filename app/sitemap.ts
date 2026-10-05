import type { MetadataRoute } from "next";
import { buildSitemapEntriesFrom } from "@/features/seo/lib/sitemap-generator";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // From MongoDB. The builder used to read a module variable that only
  // client code writes, so this served the demo seed to every crawler.
  return buildSitemapEntriesFrom(await getSeoStoreServer());
}
