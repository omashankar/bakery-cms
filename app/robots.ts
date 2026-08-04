import type { MetadataRoute } from "next";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";

/**
 * What every crawler reads first — from the database, not the demo seed.
 *
 * This called `getGlobalSeo()`, which on the server answers from a module
 * variable that only client code ever writes. So robots.txt served the seeded
 * canonical base — `https://www.monginis.example`, a domain RFC 2606 reserves
 * so that it never resolves — and the seeded `allowIndexing`, whatever the
 * admin had saved. Confirmed live before the fix: the Sitemap line pointed at
 * a host that does not exist.
 *
 * `async` also matters on its own: a synchronous `robots()` uses no
 * request-time API, so Next prerenders it at build and it could never reflect
 * a later change.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { global } = await getSeoStoreServer();
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
