import { cache } from "react";
import { connection } from "next/server";

import {
  currencyOptions,
  defaultGeneralSettings,
  timezoneOptions,
} from "@/features/settings/lib/settings-utils";

import { getPublicSettings } from "./settings.service";

/**
 * The General settings the ROOT layout needs: the browser tab, and the currency
 * and timezone every formatter reads.
 *
 * Read from Mongo on the server so the identity is in the initial HTML — the
 * tab title and favicon are decided before the first paint, and the values the
 * server formats prices and dates with are the same ones the browser hydrates
 * with. All of it is in the storefront-safe subset, so this is equally valid on
 * an admin page and on a public one.
 *
 * `cache` dedupes the read between `generateMetadata` and the layout body, which
 * both need it, within a single request.
 */
export interface SiteIdentity {
  siteName: string;
  siteDescription: string;
  favicon: string;
  currency: string;
  timezone: string;
  /**
   * False when the settings read failed and these are the built-in defaults.
   *
   * The caller must not publish an unresolved identity through
   * `setActiveLocale`: that value is module-level and shared by every render in
   * the process, so one request hitting a database blip would flip a USD shop's
   * prices to rupees for whatever other requests were in flight.
   */
  resolved: boolean;
}

const FALLBACK: SiteIdentity = {
  siteName: defaultGeneralSettings.siteName,
  siteDescription: defaultGeneralSettings.siteDescription,
  favicon: defaultGeneralSettings.favicon,
  currency: defaultGeneralSettings.currency,
  timezone: defaultGeneralSettings.timezone,
  resolved: false,
};

/** The stored value if the app supports it, else the default. */
function supported(
  value: string | undefined,
  options: readonly { value: string }[],
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed && options.some((option) => option.value === trimmed) ? trimmed : fallback;
}

export const getSiteIdentity = cache(async (): Promise<SiteIdentity> => {
  // Read per request, not at build time. Without this the pages Next can
  // prerender — the login screen, the cart, the FAQ — bake in whatever the
  // database held when the build ran, so renaming the shop or switching its
  // currency would not reach them until the next deploy. That is the same
  // "setting that changes nothing" this read exists to fix.
  await connection();

  try {
    const settings = (await getPublicSettings()) as {
      general?: Partial<SiteIdentity> & { siteDescription?: string };
    };
    const general = settings.general ?? {};

    // Every field falls back individually: a half-filled settings document must
    // not leave the tab titled "undefined" or prices formatted with no currency.
    return {
      siteName: general.siteName?.trim() || FALLBACK.siteName,
      siteDescription: general.siteDescription?.trim() || FALLBACK.siteDescription,
      favicon: general.favicon?.trim() || FALLBACK.favicon,
      // Checked against the supported set, not merely non-empty. The Zod enum
      // only constrains FUTURE writes, and both are handed to `Intl`, which
      // throws a RangeError on a code it does not know — from a settings value,
      // that would take down every rendered page.
      currency: supported(general.currency, currencyOptions, FALLBACK.currency),
      timezone: supported(general.timezone, timezoneOptions, FALLBACK.timezone),
      resolved: true,
    };
  } catch {
    // The database being unreachable is not a reason to fail to render a page.
    return FALLBACK;
  }
});
