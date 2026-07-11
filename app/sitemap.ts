import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/features/admin/seo/lib/sitemap-generator";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries();
}
