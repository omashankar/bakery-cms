import "server-only";

import type { HeaderSettings, FooterSettings } from "@/types/site-layout";
import type { AppearanceSettings } from "@/types/appearance";
import type { SeoStore } from "@/types/seo";

import { getSiteLayoutVersioned } from "./site-layout.service";

/** One section as `GET /api/site-layout/[key]` answers it, with its `X-Content-Version`. */
export interface SiteLayoutRead<T> {
  value: T;
  version: number;
}

/**
 * Header, footer and appearance together: the admin opens one gate for all
 * three (`siteLayoutHydration`), so a page that hands its screen one of them
 * reads the other two as well — three small reads, at once.
 */
export async function readSiteLayoutForAdmin() {
  const [header, footer, appearance] = await Promise.all([
    getSiteLayoutVersioned("header"),
    getSiteLayoutVersioned("footer"),
    getSiteLayoutVersioned("appearance"),
  ]);
  return {
    header: header as SiteLayoutRead<HeaderSettings>,
    footer: footer as SiteLayoutRead<FooterSettings>,
    appearance: appearance as SiteLayoutRead<AppearanceSettings>,
  };
}

/** The SEO store and its version. */
export async function readSeoForAdmin() {
  return (await getSiteLayoutVersioned("seo")) as SiteLayoutRead<SeoStore>;
}
