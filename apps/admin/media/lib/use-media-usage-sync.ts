"use client";

import { useEffect } from "react";

import { setRemoteUsageIndex } from "./media-usage";

/**
 * Loads every place a media URL can be referenced that no longer lives in this
 * browser, so the library can answer "is this file in use?" truthfully.
 *
 * The homepage and wedding layouts, the CMS pages, testimonial avatars and the
 * header/footer/SEO documents are all server-held now. The usage check was still
 * looking for them in localStorage keys that were deleted with the browser stores
 * that owned them, so it reported every one of those references as absent — and
 * the library offered files that were live on the storefront under an "Unused"
 * filter.
 *
 * Searched as raw text rather than walked field by field: these documents hold
 * URLs in a dozen shapes (a section's content, a page block, a slide's imageUrl,
 * an og:image), and a structural walk would have to be updated every time one of
 * them gains a field — which is exactly how the old check fell behind.
 */

interface Source {
  label: string;
  context: string;
  url: string;
}

const SOURCES: Source[] = [
  { label: "Homepage layout", context: "Builder", url: "/api/homepage-sections" },
  { label: "Wedding page layout", context: "Builder", url: "/api/wedding-sections" },
  { label: "CMS pages", context: "Pages", url: "/api/pages" },
  { label: "Testimonials", context: "Content", url: "/api/content/testimonials" },
  { label: "Header", context: "Site layout", url: "/api/site-layout/header" },
  { label: "Footer", context: "Site layout", url: "/api/site-layout/footer" },
  { label: "SEO", context: "Site layout", url: "/api/site-layout/seo" },
];

async function loadSource(source: Source): Promise<string | null> {
  try {
    const response = await fetch(source.url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return JSON.stringify(await response.json());
  } catch {
    return null;
  }
}

/** Long enough for a cold serverless read, short enough to catch a real blip. */
const RETRY_BASE_MS = 4000;
const MAX_RETRIES = 3;

export function useMediaUsageSync(): void {
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function load() {
      const loaded = await Promise.all(
        SOURCES.map(async (source) => ({ source, haystack: await loadSource(source) })),
      );
      if (cancelled) return;

      /**
       * Every source has to answer before this index may call itself complete.
       *
       * The failed ones were filtered out and the rest handed over as if that
       * were the whole picture, so a single failed GET made every reference in
       * that document invisible. A file used only by the homepage then read as
       * "not used anywhere" — offered under the Unused filter, and deleted from
       * a dialog whose "Still checking" caveat had been switched off by the
       * flag this sets. Cloudinary destroys the asset; the homepage breaks.
       */
      const complete = loaded.every((entry) => entry.haystack !== null);

      setRemoteUsageIndex(
        loaded
          .filter((entry) => entry.haystack !== null)
          .map((entry) => ({
            label: entry.source.label,
            context: entry.source.context,
            haystack: entry.haystack as string,
          })),
        complete,
      );

      // An incomplete index is not a permanent state to sit in: the admin is
      // held at "Still checking" until it resolves, so keep trying.
      if (!complete && attempts < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * 2 ** attempts;
        attempts += 1;
        retry = setTimeout(() => void load(), delay);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (retry !== undefined) clearTimeout(retry);
    };
  }, []);
}
