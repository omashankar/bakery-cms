"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  APPEARANCE_UPDATED_EVENT,
  applyAppearanceSettings,
} from "@/features/admin/appearance/lib/appearance-utils";
import {
  APPEARANCE_STORAGE_KEY,
  loadAppearanceSettings,
} from "@/features/admin/appearance/lib/appearance-repository";
import { applyThemeToDocument, isLightLockedPath } from "@/lib/theme";

/**
 * Keeps saved Appearance settings on the document.
 * Storefront + auth stay light; admin dark never receives cream/primary overrides.
 */
export function AppearanceThemeSync() {
  const pathname = usePathname() ?? "";
  const lightLocked = isLightLockedPath(pathname);

  useEffect(() => {
    function sync() {
      if (lightLocked) {
        applyThemeToDocument("light");
        applyAppearanceSettings(loadAppearanceSettings(), { forceSemantics: true });
        return;
      }
      applyAppearanceSettings(loadAppearanceSettings());
    }

    sync();

    function onAppearanceUpdated() {
      sync();
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      sync();
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
