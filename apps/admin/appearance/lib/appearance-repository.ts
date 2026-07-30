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

export async function saveAppearanceSettings(
  settings: AppearanceSettings
): Promise<WriteResult<AppearanceSettings>> {
  const next = normalizeSettings(settings);
  persist(next);
  applyAppearanceSettings(next);
  notifyAppearanceUpdated();
  return { value: next, persisted: await replaceAppearanceRequest(next) };
}

/** Hydration: apply the server's appearance settings locally (no re-push). */
export function persistServerAppearance(settings: AppearanceSettings): void {
  const next = normalizeSettings(settings);
  persist(next);
  applyAppearanceSettings(next);
  notifyAppearanceUpdated();
}

export async function resetAppearanceSettings(): Promise<WriteResult<AppearanceSettings>> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultAppearanceSettings);
  }
  applyAppearanceSettings(defaultAppearanceSettings);
  notifyAppearanceUpdated();
  return {
    value: defaultAppearanceSettings,
    persisted: await replaceAppearanceRequest(defaultAppearanceSettings),
  };
}

export function syncAppearanceTheme(): AppearanceSettings {
  const settings = loadAppearanceSettings();
  applyAppearanceSettings(settings);
  return settings;
}
