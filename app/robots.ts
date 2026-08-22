import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";

/**
 * What every crawler reads first — from the database, not the demo seed.
 *
 * This called `getGlobalSeo()`, which on the server answers from a module
 * variable that only client code ever writes. So robots.txt served the seeded
 * canonical base — `https://www.your-bakery.example`, a domain RFC 2606 reserves
 * so that it never resolves — and the seeded `allowIndexing`, whatever the
 * admin had saved. Confirmed live before the fix: the Sitemap line pointed at
 * a host that does not exist.
 *
 * And it has to be read PER REQUEST. `robots.js` is "a special Route Handler
 * that is cached by default unless it uses a Request-time API or dynamic
 * config" — and `async` is not one of those. Nothing in the
 * `getSeoStoreServer` → `getSiteLayout` → cms-store chain touches `headers()`,
 * `cookies()` or `connection()` either, so this really was prerendered at
 * build: an admin turning "Allow search engines to index this site" OFF saved
 * the field, and every crawler went on reading the copy baked at build time —
 * on a build without a database, the seeded `https://www.your-bakery.example` with
 * indexing ALLOWED. The admin screen even links to /robots.txt as "already
 * generated and live".
 *
 * `sitemap.ts` beside it is dynamic only by accident: it awaits
 * `isWeddingEnabledOnServer()`, which calls `connection()` and carries the
 * comment explaining why. This says it out loud instead.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
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
