import { getSettings } from "@/features/settings/server/settings.service";
import { getContent } from "@/features/content/server/content.service";
import { getHomepageState } from "@/features/cms-sections/data/homepage-sections.server";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { getProducts } from "@/features/products/data/products-service";
import { getPages } from "@/features/content/data/pages.server";
import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";

/**
 * Where the shop's media is referenced — for "is this file in use?".
 *
 * The library used to fetch ten documents itself, each through its own API,
 * as whoever was signed in. Each answered by that member's role: a manager
 * was refused the pages and the homepage outright (so the check never
 * finished and deleting sat on "Still checking"), and was handed only the
 * banners a VISITOR sees — so a switched-off banner's photo read as unused,
 * and a content editor got the published products only, so a draft
 * product's photo did too. Delete one of those and Cloudinary destroys a file
 * the shop still uses.
 *
 * Read here, whole, with the server's own access — and only the ADDRESSES
 * leave: what a draft page says stays on the server; that it shows a given
 * picture is all the library needs.
 */

export interface UsageSource {
  label: string;
  context: string;
  /** The media addresses found in the document, one per line. */
  haystack: string;
}

const SOURCES: { label: string; context: string; read: () => Promise<unknown> }[] = [
  // The shop's logo and favicon live in Settings → General.
  { label: "Settings (logo, favicon)", context: "Settings", read: () => getSettings() },
  { label: "Banners", context: "Banner", read: () => getContent("banners") },
  { label: "Homepage layout", context: "Builder", read: () => getHomepageState() },
  { label: "Catalog", context: "Catalog", read: () => getCatalog() },
  { label: "Products", context: "Products", read: () => getProducts() },
  { label: "CMS pages", context: "Pages", read: () => getPages() },
  { label: "Testimonials", context: "Content", read: () => getContent("testimonials") },
  { label: "Header", context: "Site layout", read: () => getSiteLayout("header") },
  { label: "Footer", context: "Site layout", read: () => getSiteLayout("footer") },
  { label: "SEO", context: "Site layout", read: () => getSiteLayout("seo") },
];

/** Absolute URLs, and root-relative paths, wherever they sit in a string — a field of their own or inside a page's HTML. */
const ADDRESS = /https?:\/\/[^\s"'<>()\\]+|(?<![\w.])\/[\w\-./%]+\.[A-Za-z0-9]{2,5}\b/g;

/** Every media address in a document, and nothing else from it. */
export function mediaAddresses(document: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.match(ADDRESS) ?? []) found.add(match);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(document);
  return [...found];
}

/**
 * Every source's addresses. `complete` is false when any source could not be
 * read — the library must then keep saying "Still checking" rather than call
 * a file unused.
 */
export async function getMediaUsage(): Promise<{ sources: UsageSource[]; complete: boolean }> {
  const read = await Promise.allSettled(SOURCES.map((source) => source.read()));
  const sources: UsageSource[] = [];
  read.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const { label, context } = SOURCES[index];
    sources.push({ label, context, haystack: mediaAddresses(result.value).join("\n") });
  });
  return { sources, complete: sources.length === SOURCES.length };
}
