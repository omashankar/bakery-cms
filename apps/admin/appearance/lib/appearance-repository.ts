import type { AppearanceSettings } from "@/types/appearance";
import { replaceAppearanceRequest } from "@/features/site-layout/lib/site-layout-api";
import type { WriteResult } from "@/lib/write-result";
import {
  applyAppearanceSettings,
  defaultAppearanceSettings,
  hasValidAppearanceColors,
  normalizeHexColor,
  notifyAppearanceUpdated,
  resolvePresetFromColors,
} from "./appearance-utils";

const STORAGE_KEY = "bakery-cms-appearance";
const STORAGE_VERSION_KEY = "bakery-cms-appearance-version";
const APPEARANCE_STORAGE_VERSION = 1;

export const APPEARANCE_STORAGE_KEY = STORAGE_KEY;

function persist(settings: AppearanceSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  localStorage.setItem(STORAGE_VERSION_KEY, String(APPEARANCE_STORAGE_VERSION));
}

function normalizeSettings(settings: AppearanceSettings): AppearanceSettings {
  const colors = {
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    surfaceColor: settings.surfaceColor,
  };

  if (hasValidAppearanceColors(settings)) {
    colors.primaryColor = normalizeHexColor(settings.primaryColor);
    colors.accentColor = normalizeHexColor(settings.accentColor);
    colors.surfaceColor = normalizeHexColor(settings.surfaceColor);
  }

  return {
    ...settings,
    ...colors,
    borderRadius: settings.borderRadius === 16 ? 16 : 12,
    preset: resolvePresetFromColors(colors),
  };
}

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof window === "undefined") return defaultAppearanceSettings;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultAppearanceSettings);
    return defaultAppearanceSettings;
  }

  try {
    const parsed = JSON.parse(raw) as AppearanceSettings;
    if (!parsed?.primaryColor) return defaultAppearanceSettings;

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
    if (storedVersion < APPEARANCE_STORAGE_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, String(APPEARANCE_STORAGE_VERSION));
    }

    return normalizeSettings({
      ...defaultAppearanceSettings,
      ...parsed,
    });
  } catch {
    return defaultAppearanceSettings;
  }
}

/**
 * Local write first, then the server — and the local write is UNDONE when the
 * server refuses.
 *
 * Without the rollback a rejected save still repainted the admin and still sat
 * in localStorage, and nothing put it right. `ensureSiteLayoutHydrated`
 * short-circuits once the gate has settled, so the poisoned cache survives:
 * `appearance-theme-sync` re-reads it on every navigation, the page re-applies
 * it on unmount — undoing Discard — and a remount adopts it as the SAVED value,
 * at which point the screen calls a palette the server rejected "Saved".
 *
 * The rollback restores ONLY if this write is still the one in the cache.
 * Restoring unconditionally would undo a concurrent save the server had
 * accepted in between — a rejected write destroying a good one. The template
 * repositories carry the same guard for the same reason.
 */
async function persistAndSync(next: AppearanceSettings): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  persist(next);
  applyAppearanceSettings(next);
  notifyAppearanceUpdated();

  const accepted = await replaceAppearanceRequest(next);

  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(next);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      // Repaint from whatever the cache now holds, so the screen and the
      // stored value agree again.
      applyAppearanceSettings(loadAppearanceSettings());
      notifyAppearanceUpdated();
    }
  }

  return accepted;
}

export async function saveAppearanceSettings(
  settings: AppearanceSettings
): Promise<WriteResult<AppearanceSettings>> {
  const next = normalizeSettings(settings);
  return { value: next, persisted: await persistAndSync(next) };
}

/** Hydration: apply the server's appearance settings locally (no re-push). */
export function persistServerAppearance(settings: AppearanceSettings): void {
  const next = normalizeSettings(settings);
  persist(next);
  applyAppearanceSettings(next);
  notifyAppearanceUpdated();
}

/**
 * Reset goes through the same path, and that matters more here than anywhere.
 *
 * This wiped the cache to the demo defaults and repainted before asking the
 * server. A refusal therefore left the admin looking at the demo palette with
 * their real one gone from this browser — the most destructive action on the
 * screen was the one with no way back.
 */
export async function resetAppearanceSettings(): Promise<WriteResult<AppearanceSettings>> {
  return {
    value: defaultAppearanceSettings,
    persisted: await persistAndSync(defaultAppearanceSettings),
  };
}

export function syncAppearanceTheme(): AppearanceSettings {
  const settings = loadAppearanceSettings();
  applyAppearanceSettings(settings);
  return settings;
}
