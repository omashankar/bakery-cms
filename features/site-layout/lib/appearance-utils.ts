import type { AppearancePresetDefinition, AppearanceSettings } from "@/types/appearance";

/**
 * The palette arithmetic moved to `features/site-layout/lib/appearance-tokens`.
 *
 * The storefront renders these tokens on the SERVER now, and neither the
 * customer website nor `features/site-layout/server` may import from
 * `apps/admin`. Re-exported here so the admin keeps one import path — and so
 * there is still exactly one implementation of the arithmetic.
 */
import {
  appearanceCssVariables,
  defaultAppearanceSettings,
  hasValidAppearanceColors,
  isValidHexColor,
  normalizeHexColor,
  type ApplyAppearanceOptions,
} from "@/features/site-layout/lib/appearance-tokens";

export {
  appearanceCssVariables,
  defaultAppearanceSettings,
  hasValidAppearanceColors,
  isValidHexColor,
  normalizeHexColor,
};
export type { ApplyAppearanceOptions };

export const appearancePresets: AppearancePresetDefinition[] = [
  {
    id: "classic",
    name: "Classic Bakery",
    description: "Brown primary, cream surfaces, minimal gold accent.",
    primaryColor: "#6f4e37",
    accentColor: "#d4a373",
    surfaceColor: "#faf8f4",
    swatches: ["#6f4e37", "#d4a373", "#faf8f4", "#ffffff"],
  },
  {
    id: "espresso",
    name: "Espresso",
    description: "Deeper cocoa tones with warm neutral surfaces.",
    primaryColor: "#4a3324",
    accentColor: "#c9b09a",
    surfaceColor: "#f7f3ee",
    swatches: ["#4a3324", "#c9b09a", "#f7f3ee", "#ffffff"],
  },
  {
    id: "rose-cocoa",
    name: "Rose Cocoa",
    description: "Slightly warmer brown with soft blush-cream backgrounds.",
    primaryColor: "#7a4a3a",
    accentColor: "#d4a373",
    surfaceColor: "#fdf8f6",
    swatches: ["#7a4a3a", "#d4a373", "#fdf8f6", "#ffffff"],
  },
];

export const APPEARANCE_UPDATED_EVENT = "bakery-appearance-updated";

export function getPresetById(id: AppearanceSettings["preset"]) {
  return appearancePresets.find((preset) => preset.id === id);
}

export function settingsFromPreset(
  presetId: Exclude<AppearanceSettings["preset"], "custom">
): AppearanceSettings {
  const preset = getPresetById(presetId);
  if (!preset) return defaultAppearanceSettings;
  return {
    preset: presetId,
    primaryColor: preset.primaryColor,
    accentColor: preset.accentColor,
    surfaceColor: preset.surfaceColor,
    borderRadius: defaultAppearanceSettings.borderRadius,
  };
}

/** Match colors to a known preset, otherwise custom. */
export function resolvePresetFromColors(
  settings: Pick<AppearanceSettings, "primaryColor" | "accentColor" | "surfaceColor">
): AppearanceSettings["preset"] {
  if (
    !isValidHexColor(settings.primaryColor) ||
    !isValidHexColor(settings.accentColor) ||
    !isValidHexColor(settings.surfaceColor)
  ) {
    return "custom";
  }

  const primary = normalizeHexColor(settings.primaryColor);
  const accent = normalizeHexColor(settings.accentColor);
  const surface = normalizeHexColor(settings.surfaceColor);

  const match = appearancePresets.find(
    (preset) =>
      normalizeHexColor(preset.primaryColor) === primary &&
      normalizeHexColor(preset.accentColor) === accent &&
      normalizeHexColor(preset.surfaceColor) === surface
  );

  return match?.id ?? "custom";
}

/**
 * Apply Appearance settings to the document.
 * - Brand tokens (bakery / cream / gold / radius) always update.
 * - Light semantic tokens update on light surfaces (or when forceSemantics).
 * - Never strips admin dark inline vars.
 */
export function applyAppearanceSettings(
  settings: AppearanceSettings,
  options?: ApplyAppearanceOptions
): void {
  if (typeof document === "undefined") return;
  applyAppearanceSettingsTo(document.documentElement, settings, {
    forceSemantics:
      options?.forceSemantics === true ||
      !document.documentElement.classList.contains("dark"),
  });
}

/**
 * Write Appearance tokens onto any element (e.g. builder preview light island).
 */
export function applyAppearanceSettingsTo(
  el: HTMLElement,
  settings: AppearanceSettings,
  options?: ApplyAppearanceOptions
): void {
  for (const [name, value] of Object.entries(appearanceCssVariables(settings, options))) {
    el.style.setProperty(name, value);
  }
}

export function clearAppearanceOverrides(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const keys = [
    "--brand-primary",
    "--bakery-700",
    "--bakery-600",
    "--bakery-500",
    "--bakery-800",
    "--bakery-900",
    "--brand-accent",
    "--gold-300",
    "--gold-400",
    "--gold-500",
    "--surface-cream",
    "--cream-50",
    "--cream-100",
    "--cream-200",
    "--beige",
    "--radius",
    "--primary",
    "--primary-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--ring",
    "--sidebar-ring",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--accent",
    "--accent-foreground",
    "--sidebar",
  ];
  keys.forEach((key) => root.style.removeProperty(key));
}

export function notifyAppearanceUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APPEARANCE_UPDATED_EVENT));
}

export type AppearanceOverview = {
  presetLabel: string;
  isCustom: boolean;
  borderRadius: number;
  primaryColor: string;
  accentColor: string;
};

export function getAppearanceOverview(settings: AppearanceSettings): AppearanceOverview {
  const presetId = resolvePresetFromColors(settings);
  const preset = getPresetById(presetId);
  return {
    presetLabel: presetId === "custom" ? "Custom" : preset?.name ?? "Custom",
    isCustom: presetId === "custom",
    borderRadius: settings.borderRadius,
    primaryColor: isValidHexColor(settings.primaryColor)
      ? normalizeHexColor(settings.primaryColor)
      : settings.primaryColor || "—",
    accentColor: isValidHexColor(settings.accentColor)
      ? normalizeHexColor(settings.accentColor)
      : settings.accentColor || "—",
  };
}
