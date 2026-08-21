"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  APPEARANCE_UPDATED_EVENT,
  applyAppearanceSettings,
} from "@/features/site-layout/lib/appearance-utils";
import {
  APPEARANCE_STORAGE_KEY,
  loadAppearanceSettings,
} from "@/features/site-layout/lib/appearance-repository";
import { applyThemeToDocument, isLightLockedPath } from "@/lib/theme";
import { APPEARANCE_SSR_STYLE_ID } from "@/features/site-layout/lib/appearance-tokens";
import { siteLayoutHydration } from "@/features/site-layout/lib/site-layout-api";

/**
 * Keeps saved Appearance settings on the document.
 * Storefront + auth stay light; admin dark never receives cream/primary overrides.
 */
export function AppearanceThemeSync() {
  const pathname = usePathname() ?? "";
  const lightLocked = isLightLockedPath(pathname);

  useEffect(() => {
    /**
     * Do not paint over a palette the SERVER already got right.
     *
     * `loadAppearanceSettings()` reads localStorage, and a first-time visitor
     * has none — so it answers with the DEFAULTS and even persists them. Before
     * the storefront server-rendered anything that was merely the same wrong
     * answer twice. Now it would be strictly worse: the shop's real colours are
     * already on the page, and this would repaint them to the demo palette
     * until the fetch lands, or for the whole session if it fails.
     *
     * So on a server-painted page, wait. `ensureSiteLayoutHydrated` fires
     * `APPEARANCE_UPDATED_EVENT` once the real palette is cached, and this runs
     * again with something worth applying.
     */
    function serverAlreadyPainted(): boolean {
      return document.getElementById(APPEARANCE_SSR_STYLE_ID) !== null;
    }

    function sync(fromCache = false) {
      // The theme CLASS is unrelated to the palette and must still be set.
      if (lightLocked) applyThemeToDocument("light");

      if (!fromCache && serverAlreadyPainted() && !siteLayoutHydration.hasSettled()) {
        return;
      }

      applyAppearanceSettings(
        loadAppearanceSettings(),
        lightLocked ? { forceSemantics: true } : undefined,
      );
    }

    sync();

    // Fired by `persistServerAppearance` once the SERVER's palette is cached,
    // and by every admin save. Either way the cache is real, so apply it.
    function onAppearanceUpdated() {
      sync(true);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      // Another tab wrote a real palette.
      sync(true);
    }

    window.addEventListener(APPEARANCE_UPDATED_EVENT, onAppearanceUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(APPEARANCE_UPDATED_EVENT, onAppearanceUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [lightLocked, pathname]);

  return null;
}
