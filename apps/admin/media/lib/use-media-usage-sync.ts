"use client";

import { useEffect, useState } from "react";

import { setRemoteUsageIndex } from "./media-usage";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

/**
 * Loads every place a media URL can be referenced that no longer lives in this
 * browser, so the library can answer "is this file in use?" truthfully.
 *
 * The homepage layout, the CMS pages, testimonial avatars, the header/footer/SEO
 * documents, the logo in Settings, banners, the catalog and every product are
 * all server-held. The server reads them WHOLE — drafts, switched-off banners
 * and unpublished products included — and sends back only the media addresses
 * in each (`/api/media/usage`, see features/media/server/media.usage.ts).
 *
 * This used to fetch the ten documents itself, through their own APIs, so each
 * answered by the member's role: a manager was refused the pages and the
 * homepage (the index never finished, and every delete sat on "Still
 * checking"), and anyone without the banner permission was given a visitor's
 * banners — a switched-off banner's photo read as unused, and could be deleted.
 *
 * Searched as raw text rather than walked field by field: these documents hold
 * URLs in a dozen shapes (a section's content, a page block, a slide's imageUrl,
 * an og:image), and a structural walk would fall behind every new field.
 */

interface UsageAnswer {
  sources: { label: string; context: string; haystack: string }[];
  complete: boolean;
}

export const MEDIA_USAGE_URL = "/api/media/usage";

async function loadUsage(): Promise<UsageAnswer | null> {
  try {
    const response = await fetch(MEDIA_USAGE_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      noteAuthStatus(response.status);
      return null;
    }
    const json = (await response.json()) as { success?: boolean; data?: UsageAnswer | null };
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

/** Long enough for a cold serverless read, short enough to catch a real blip. */
const RETRY_BASE_MS = 4000;
const MAX_RETRIES = 3;

/**
 * Returns a number that changes every time the index is filled.
 *
 * The index is module state, and setting it told nobody: the library counted
 * "Unused" while the requests were still out — every file, since nothing was
 * known yet — memoised that on its file list, and kept showing it for good.
 * The shop's live logo and banners sat under "Unused 98 — Not referenced".
 * Anything that reads usage puts this in its dependencies.
 */
export function useMediaUsageSync(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function load() {
      const answer = await loadUsage();
      if (cancelled) return;

      /**
       * Every source has to answer before this index may call itself complete.
       *
       * A failed source used to be dropped and the rest handed over as if that
       * were the whole picture, so a single failed read made every reference in
       * that document invisible. A file used only by the homepage then read as
       * "not used anywhere" — offered under the Unused filter, and deleted from
       * a dialog whose "Still checking" caveat had been switched off by the
       * flag this sets. Cloudinary destroys the asset; the homepage breaks.
       */
      const complete = Boolean(answer?.complete);
      setRemoteUsageIndex(answer?.sources ?? [], complete);
      setVersion((value) => value + 1);

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
  return version;
}
