import type { MetadataRoute } from "next";
import { getGlobalSeo } from "@/features/seo/lib/seo-repository";

export default function robots(): MetadataRoute.Robots {
  const global = getGlobalSeo();
  const base = global.canonicalBaseUrl.replace(/\/$/, "");

  if (!global.allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: `${base}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
