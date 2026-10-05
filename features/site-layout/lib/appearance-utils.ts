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
    name: "Classic Cream",
    description: "Warm brown primary, cream surfaces, a soft gold accent.",
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
  /*
    NOT BROWN, which is the whole reason these five are here.

    Every primary is dark enough that `readableInkOn` answers white and the
    button clears 4.5:1 with room to spare — measured, lowest is 7.3:1
    across all eight — and every surface is light, because the storefront is
    light-only and the Appearance screen says so.

    Named for the colour, never for a trade: a shop that sells flowers
    should not have to read past three kinds of cake to find its palette.
  */
  {
    id: "ink",
    name: "Ink",
    description: "Deep navy with a muted gold accent on cool white.",
    primaryColor: "#1f2a44",
    accentColor: "#c8a04a",
    surfaceColor: "#f5f7fa",
    swatches: ["#1f2a44", "#c8a04a", "#f5f7fa", "#ffffff"],
  },
  {
    id: "forest",
    name: "Forest",
    description: "Deep green with a warm amber accent on a soft green white.",
    primaryColor: "#24543f",
    accentColor: "#d99a3e",
    surfaceColor: "#f3f8f4",
    swatches: ["#24543f", "#d99a3e", "#f3f8f4", "#ffffff"],
  },
  {
    id: "plum",
    name: "Plum",
    description: "Deep purple with a dusty rose accent on a pale blush.",
    primaryColor: "#5b2e59",
    accentColor: "#c97b9c",
    surfaceColor: "#f8f3f7",
    swatches: ["#5b2e59", "#c97b9c", "#f8f3f7", "#ffffff"],
  },
  {
    id: "teal",
    name: "Teal",
    description: "Deep teal with a bright orange accent on a cool white.",
    primaryColor: "#0f4c5c",
    accentColor: "#e36414",
    surfaceColor: "#f1f6f8",
    swatches: ["#0f4c5c", "#e36414", "#f1f6f8", "#ffffff"],
  },
  {
    id: "slate",
    name: "Slate",
    description: "Neutral grey-blue with a soft green accent. The quietest of these.",
    primaryColor: "#33404d",
    accentColor: "#5b8c85",
    surfaceColor: "#f6f7f8",
    swatches: ["#33404d", "#5b8c85", "#f6f7f8", "#ffffff"],
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

/**
 * Put every token this palette can write back to the stylesheet's own value.
 *
 * THE LIST IS ASKED FOR, NOT WRITTEN DOWN. It used to be twenty-eight names
 * copied out by hand, which is a second copy of the token map with nothing
 * holding the two in step: a token added to the generator and not to this
 * array is a token Reset leaves painted on the page for the rest of the
 * session, and the failure is silent — the shop presses Reset, most of the
 * colours go back, and the ones that stay look like the stylesheet's.
 *
 * Asking the generator for the names cannot drift, because it IS the names.
 * The default settings are only a vehicle for the keys; the values are
 * discarded, and `removeProperty` uncovers whatever the stylesheet says.
 */
export function clearAppearanceOverrides(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  for (const key of Object.keys(appearanceCssVariables(defaultAppearanceSettings))) {
    root.style.removeProperty(key);
  }
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
