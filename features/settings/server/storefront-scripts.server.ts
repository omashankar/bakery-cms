import "server-only";

import { getSettings } from "@/features/settings/server/settings.service";
import { getAdminConfig } from "@/features/admin-config/server/admin-config.service";
import type { AnalyticsSettings } from "@/types/settings";

/**
 * What the Analytics and Custom Code screens promise, actually collected.
 *
 * Both screens stored their values durably, validated them, summarised them
 * ("2 of 4 integrations configured") and rendered them NOWHERE. There was no
 * `next/script` import in the repository and no consumer of the custom-code
 * store outside the admin page that wrote it. A shop owner could paste a
 * Google Analytics id, be told it was configured, and never receive a single
 * pageview; they could write CSS under a heading reading "Inject custom CSS and
 * JavaScript into the storefront" and nothing was injected.
 *
 * Read once per storefront render, on the server, so the tags are in the HTML
 * rather than appearing after hydration — a tracker that loads late misses the
 * pageview it exists to record.
 */

export interface StorefrontScripts {
  analytics: AnalyticsSettings;
  customCss: string;
  customJs: string;
}

const EMPTY: StorefrontScripts = {
  analytics: {
    googleAnalyticsId: "",
    googleTagManagerId: "",
    facebookPixelId: "",
    hotjarId: "",
  },
  customCss: "",
  customJs: "",
};

/**
 * Ids are re-checked here, not merely at write time.
 *
 * The schema only constrains future writes, and these strings are interpolated
 * into a script that runs on every visitor's browser. A value that is not
 * plainly an id is dropped rather than emitted — the tag would not work anyway,
 * and a malformed one is the difference between "no analytics" and "a broken
 * page".
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function safeId(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return ID_PATTERN.test(trimmed) ? trimmed : "";
}

export async function getStorefrontScripts(): Promise<StorefrontScripts> {
  try {
    const [settingsRaw, customCodeRaw] = await Promise.all([
      getSettings(),
      getAdminConfig("custom-code"),
    ]);

    const analytics = ((settingsRaw as unknown as Record<string, unknown>).analytics ??
      {}) as Partial<AnalyticsSettings>;
    const customCode = (customCodeRaw ?? {}) as { css?: unknown; js?: unknown };

    return {
      analytics: {
        googleAnalyticsId: safeId(analytics.googleAnalyticsId),
        googleTagManagerId: safeId(analytics.googleTagManagerId),
        facebookPixelId: safeId(analytics.facebookPixelId),
        hotjarId: safeId(analytics.hotjarId),
      },
      customCss: typeof customCode.css === "string" ? customCode.css : "",
      customJs: typeof customCode.js === "string" ? customCode.js : "",
    };
  } catch {
    // A database blip must not take the storefront down. No tags is the right
    // failure: a half-written tracker is worse than none.
    return EMPTY;
  }
}
