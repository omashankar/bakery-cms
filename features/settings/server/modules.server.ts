import { cache } from "react";
import { connection } from "next/server";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import type { ModuleSettings } from "@/types/settings";

import { getPublicSettings } from "./settings.service";

/**
 * Module state read on the SERVER, for gating whole routes.
 *
 * The client-side gating (`data-gate-*`, `getModuleSettings()` in components)
 * hides links and pickers, which is right for a chooser inside a page. It is not
 * enough for a page: hiding every link to `/store/wedding-cakes` still leaves it
 * serving 200 to a bookmark, a search result, or anyone who has the URL — so a
 * shop that switched the Wedding module off kept a fully working wedding-cakes
 * page and kept taking wedding enquiries through it.
 *
 * `cache` dedupes the read between `generateMetadata` and the page body.
 */
export interface ServerModules {
  modules: ModuleSettings;
  /**
   * Gated by its own switch, and nothing else.
   *
   * This was `businessType === "bakery" && modules.weddingBuilder`. The
   * business type is gone, so the switch is the whole gate — which is what it
   * always described itself as. The DEFAULT now carries what the enum used to
   * (see `defaultModuleSettings`), so a fresh install of any trade does not
   * ship a live Wedding Builder.
   */
  weddingEnabled: boolean;
}

function resolve(modules: ModuleSettings): ServerModules {
  return { modules, weddingEnabled: modules.weddingBuilder };
}

export const getServerModules = cache(async (): Promise<ServerModules> => {
  // Read per request. `sitemap.xml` is otherwise prerendered at build time, so
  // the module state would be frozen at whatever it was when the build ran —
  // switching Wedding off would keep advertising a route that now 404s, and
  // switching it back on would never re-list it.
  await connection();

  try {
    const settings = (await getPublicSettings()) as {
      modules?: Partial<ModuleSettings>;
    };

    return resolve({ ...defaultModuleSettings, ...(settings.modules ?? {}) });
  } catch {
    /**
     * A database that cannot be reached must not take a page down.
     *
     * `defaultModuleSettings` fails open for exactly this reason. It was briefly
     * flipped so wedding defaulted false, which made an outage 404
     * /store/wedding-cakes, redirect the owner out of their own builder and drop
     * the URL from a sitemap that still resolved — harm outlasting the outage
     * that caused it. The comment on this line was edited in the same commit to
     * claim the defaults hid nothing new, which was not true; it says what the
     * code does now.
     */
    return resolve(defaultModuleSettings);
  }
});

/** True when the wedding page, builder and storefront link should exist at all. */
export async function isWeddingEnabledOnServer(): Promise<boolean> {
  return (await getServerModules()).weddingEnabled;
}
