import type { Metadata } from "next";
import type { GlobalSeoSettings, SeoRouteEntry, SeoStore } from "@/types/seo";
import { getGlobalSeo, loadSeoStore } from "./seo-repository";

export const TITLE_IDEAL_MAX = 60;
export const DESCRIPTION_IDEAL_MAX = 160;

export function countChars(value: string): number {
  return value.trim().length;
}

export function charCountTone(length: number, idealMax: number): string {
  if (length === 0) return "text-muted-foreground";
  if (length <= idealMax) return "text-green-700 dark:text-green-400";
  if (length <= idealMax + 15) return "text-amber-700 dark:text-amber-400";
  return "text-destructive";
}

export function formatKeywords(keywords: string[]): string {
  return keywords.join(", ");
}

export function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildCanonicalUrl(path: string, global?: GlobalSeoSettings): string {
  const settings = global ?? getGlobalSeo();
  const base = settings.canonicalBaseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function resolveRouteTitle(entry: SeoRouteEntry, global?: GlobalSeoSettings): string {
  const settings = global ?? getGlobalSeo();
  const suffix = settings.titleSuffix.trim();
  if (!suffix) return entry.metaTitle;
  const siteName = settings.siteName.trim();
  if (siteName && entry.metaTitle.toLowerCase().includes(siteName.toLowerCase())) {
    return entry.metaTitle;
  }
  return `${entry.metaTitle} ${suffix}`.trim();
}

/**
 * The metadata for one route, from a store handed in.
 *
 * Split out because the client and the SERVER get the store from different
 * places and must produce identical metadata from it. `buildRouteMetadata`
 * below reads the client cache; `buildRouteMetadataServer` reads MongoDB. Two
 * implementations of this arithmetic is how a page title and its canonical URL
 * end up disagreeing about the same route.
 */
export function buildRouteMetadataFrom(store: SeoStore, routeKey: string): Metadata {
  const global = store.global;
  const entry = store.routes.find((route) => route.routeKey === routeKey) ?? null;
  if (!entry) {
    return {
      title: { absolute: global.siteName },
      description: global.defaultDescription,
    };
  }

  const title = resolveRouteTitle(entry, global);
  const description = entry.metaDescription || global.defaultDescription;
  const ogImage = entry.ogImage || global.defaultOgImage;
  const twitterCard = entry.twitterCard ?? global.defaultTwitterCard;

  const robots =
    entry.noIndex || !global.allowIndexing
      ? { index: false, follow: false }
      : entry.noFollow
        ? { index: true, follow: false }
        : undefined;

  return {
    // `absolute`, so the root layout's "%s | <site name>" template does not
    // apply: `resolveRouteTitle` has already appended the SEO title suffix, and
    // letting the template run again renders "Wedding Cakes | Acme | Acme".
    title: { absolute: title },
    description,
    keywords:
      entry.metaKeywords && entry.metaKeywords.length > 0
        ? entry.metaKeywords
        : global.defaultKeywords,
    robots,
    alternates: {
      canonical: buildCanonicalUrl(entry.path, global),
    },
    openGraph: {
      title,
      description,
      url: buildCanonicalUrl(entry.path, global),
      siteName: global.siteName,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: twitterCard,
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      site: global.twitterSite,
      creator: global.twitterCreator,
    },
  };
}

/**
 * The client-side wrapper, for anything rendering from the browser cache.
 *
 * Every STOREFRONT page used to call this from a module-level
 * `export const metadata = ...`, which Next evaluates once when the module
 * loads — so it could never read a database even if the reader worked. It
 * did not: on the server `getGlobalSeo()` answers from a module variable that
 * only client code ever writes, i.e. the demo seed, forever.
 */
export function buildRouteMetadata(routeKey: string): Metadata {
  return buildRouteMetadataFrom(loadSeoStore(), routeKey);
}

export function filterSeoRoutes(
  routes: SeoRouteEntry[],
  query: string
): SeoRouteEntry[] {
  return filterSeoRouteList(routes, { search: query, status: "all", sort: "label" });
}

export type SeoRouteListFilters = {
  search: string;
  status: "all" | "indexable" | "noindex" | "nofollow";
  sort: "label" | "updated" | "title";
};

export const defaultSeoRouteFilters: SeoRouteListFilters = {
  search: "",
  status: "all",
  sort: "label",
};

export type SeoOverview = {
  total: number;
  indexable: number;
  noindex: number;
  nofollow: number;
  sitemapCount: number;
  indexingAllowed: boolean;
};

export function getSeoOverview(
  routes: SeoRouteEntry[],
  global: GlobalSeoSettings
): SeoOverview {
  const noindex = routes.filter((entry) => entry.noIndex).length;
  const nofollow = routes.filter((entry) => entry.noFollow && !entry.noIndex).length;
  const indexable = routes.filter((entry) => !entry.noIndex).length;
  return {
    total: routes.length,
    indexable,
    noindex,
    nofollow,
    sitemapCount: global.allowIndexing ? indexable : 0,
    indexingAllowed: global.allowIndexing,
  };
}

export function filterSeoRouteList(
  routes: SeoRouteEntry[],
  filters: SeoRouteListFilters
): SeoRouteEntry[] {
  const normalized = filters.search.trim().toLowerCase();

  let next = routes.filter((entry) => {
    if (filters.status === "indexable" && entry.noIndex) return false;
    if (filters.status === "noindex" && !entry.noIndex) return false;
    if (filters.status === "nofollow" && !entry.noFollow) return false;

    if (!normalized) return true;
    const haystack = [
      entry.label,
      entry.path,
      entry.metaTitle,
      entry.metaDescription,
      entry.metaKeywords?.join(" ") ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });

  next = [...next].sort((a, b) => {
    if (filters.sort === "updated") {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    if (filters.sort === "title") {
      return a.metaTitle.localeCompare(b.metaTitle);
    }
    return a.label.localeCompare(b.label);
  });

  return next;
}

export function isValidJson(value: string): boolean {
  if (!value.trim()) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
