import "server-only";

import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";
import { seedGlobal, seedStore } from "@/features/seo/lib/seo-repository";
import type { SeoStore } from "@/types/seo";
import type { Metadata } from "next";
import { buildRouteMetadataFrom } from "@/features/seo/lib/seo-metadata";

/**
 * The shop's SEO settings, read on the SERVER from MongoDB.
 *
 * `loadSeoStore()` answers with a module-level `serverStore` variable when there
 * is no `window`, and every writer of that variable is a `"use client"` module.
 * So on the server it is the DEMO SEED and nothing else, for the life of the
 * process — which meant robots.txt, sitemap.xml and the canonical/OG/title
 * metadata of every storefront page served the seeded values no matter what the
 * admin saved. The seeded canonical base is `https://www.monginis.example`, and
 * `.example` is reserved by RFC 2606 precisely so that it never resolves: the
 * sitemap Google was handed pointed at a host that does not exist.
 *
 * `email.service.ts` already read the store this way and was the only server
 * consumer doing it correctly.
 *
 * Defaults are merged UNDER the stored value rather than substituted for a
 * missing record, so a shop provisioned before a field existed gets that
 * field's default instead of `undefined` reaching a metadata builder.
 */
export async function getSeoStoreServer(): Promise<SeoStore> {
  try {
    const stored = (await getSiteLayout("seo")) as SeoStore | null;
    if (!stored?.global) return seedStore();

    return {
      global: { ...seedGlobal(), ...stored.global },
      routes: (Array.isArray(stored.routes) ? stored.routes : []).map((entry) => ({
        ...entry,
        metaKeywords: entry.metaKeywords ?? [],
        noFollow: entry.noFollow ?? false,
      })),
    };
  } catch {
    // A database blip must not take the storefront's metadata down with it.
    return seedStore();
  }
}

/**
 * The metadata for one route, from the database.
 *
 * Every storefront page declared `export const metadata = buildRouteMetadata(…)`,
 * which Next evaluates ONCE when the module loads — so it could not read a
 * database even if the reader had worked. Pages call this from
 * `generateMetadata` instead, which runs per request.
 */
export async function buildRouteMetadataServer(routeKey: string): Promise<Metadata> {
  return buildRouteMetadataFrom(await getSeoStoreServer(), routeKey);
}
