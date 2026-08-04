import { cache } from "react";
import { connection } from "next/server";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import type { BusinessType, ModuleSettings } from "@/types/settings";

import { getPublicSettings } from "./settings.service";

/**
 * Module state read on the SERVER, for gating whole routes.
 *
 * The client-side gating (`data-gate-*`, `getModuleSettings()` in components)
 * hides links and pickers, which is right for a chooser inside a page. It is not
 * enough for a page: hiding every link to `/store/wedding-cakes` still leaves it
 * serving 200 to a bookmark, a search result, or anyone who has the URL — so a
 * shop that switched the Wedding module off, or that is not a bakery at all,
 * kept a fully working wedding-cakes page and kept taking wedding enquiries
 * through it.
 *
 * `cache` dedupes the read between `generateMetadata` and the page body.
 */
export interface ServerModules {
  modules: ModuleSettings;
  businessType: BusinessType;
  /** Bakery-only, and gated by its own switch — mirrors `isWeddingEnabled()`. */
  weddingEnabled: boolean;
}

function resolve(modules: ModuleSettings, businessType: BusinessType): ServerModules {
  return {
    modules,
    businessType,
    weddingEnabled: businessType === "bakery" && modules.weddingBuilder,
  };
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
      general?: { businessType?: BusinessType };
    };

    return resolve(
      { ...defaultModuleSettings, ...(settings.modules ?? {}) },
      settings.general?.businessType ?? "bakery",
    );
  } catch {
    // A database that cannot be reached must not take a page down. Defaults are
    // the bakery template with every module on — i.e. nothing newly hidden.
    return resolve(defaultModuleSettings, "bakery");
  }
});

/** True when the wedding page, builder and storefront link should exist at all. */
export async function isWeddingEnabledOnServer(): Promise<boolean> {
  return (await getServerModules()).weddingEnabled;
}
