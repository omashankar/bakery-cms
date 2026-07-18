import type { AppearanceSettings } from "@/types/appearance";
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

export function saveAppearanceSettings(settings: AppearanceSettings): AppearanceSettings {
  const next = normalizeSettings(settings);
  persist(next);
  applyAppearanceSettings(next);
  notifyAppearanceUpdated();
  return next;
}

export function resetAppearanceSettings(): AppearanceSettings {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultAppearanceSettings);
  }
  applyAppearanceSettings(defaultAppearanceSettings);
  notifyAppearanceUpdated();
  return defaultAppearanceSettings;
}

export function syncAppearanceTheme(): AppearanceSettings {
  const settings = loadAppearanceSettings();
  applyAppearanceSettings(settings);
  return settings;
}
