import type { AppearancePresetDefinition, AppearanceSettings } from "@/types/appearance";

export const appearancePresets: AppearancePresetDefinition[] = [
  {
    id: "monginis",
    name: "Monginis Classic",
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

export const defaultAppearanceSettings: AppearanceSettings = {
  preset: "monginis",
  primaryColor: "#6f4e37",
  accentColor: "#d4a373",
  surfaceColor: "#faf8f4",
  borderRadius: 12,
};

export const APPEARANCE_UPDATED_EVENT = "bakery-appearance-updated";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

export function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return trimmed;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

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

export function hasValidAppearanceColors(settings: AppearanceSettings): boolean {
  return (
    isValidHexColor(settings.primaryColor) &&
    isValidHexColor(settings.accentColor) &&
    isValidHexColor(settings.surfaceColor)
  );
}

function mixHex(base: string, amount: number): string {
  const normalized = normalizeHexColor(base).replace("#", "");
  if (normalized.length !== 6) return base;
  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return base;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

/** Darken toward black by amount 0–1. */
function shadeHex(base: string, amount: number): string {
  const normalized = normalizeHexColor(base).replace("#", "");
  if (normalized.length !== 6) return base;
  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return base;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const shade = (channel: number) =>
    Math.round(channel * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${shade(r)}${shade(g)}${shade(b)}`;
}

export type ApplyAppearanceOptions = {
  /**
   * When true, always write light semantic tokens (--primary, --muted, …).
   * Use on storefront after forcing light. Default: only when document is not dark.
   */
  forceSemantics?: boolean;
};

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
  if (!hasValidAppearanceColors(settings)) return;

  const primaryColor = normalizeHexColor(settings.primaryColor);
  const accentColor = normalizeHexColor(settings.accentColor);
  const surfaceColor = normalizeHexColor(settings.surfaceColor);
  const borderRadius = settings.borderRadius === 16 ? 16 : 12;
  const applySemantics = options?.forceSemantics !== false;

  el.style.setProperty("--brand-primary", primaryColor);
  el.style.setProperty("--bakery-700", primaryColor);
  el.style.setProperty("--bakery-600", mixHex(primaryColor, 0.08));
  el.style.setProperty("--bakery-500", mixHex(primaryColor, 0.18));
  el.style.setProperty("--bakery-800", shadeHex(primaryColor, 0.12));
  el.style.setProperty("--bakery-900", shadeHex(primaryColor, 0.22));

  el.style.setProperty("--brand-accent", accentColor);
  el.style.setProperty("--gold-300", accentColor);
  el.style.setProperty("--gold-400", accentColor);
  el.style.setProperty("--gold-500", shadeHex(accentColor, 0.08));

  el.style.setProperty("--surface-cream", surfaceColor);
  el.style.setProperty("--cream-50", "#ffffff");
  el.style.setProperty("--cream-100", surfaceColor);
  el.style.setProperty("--cream-200", shadeHex(surfaceColor, 0.04));
  el.style.setProperty("--beige", shadeHex(surfaceColor, 0.06));

  el.style.setProperty("--radius", `${borderRadius}px`);

  if (!applySemantics) return;

  el.style.setProperty("--primary", primaryColor);
  el.style.setProperty("--primary-foreground", "#ffffff");
  el.style.setProperty("--sidebar-primary", primaryColor);
  el.style.setProperty("--sidebar-primary-foreground", "#ffffff");
  el.style.setProperty("--ring", accentColor);
  el.style.setProperty("--sidebar-ring", accentColor);
  el.style.setProperty("--secondary", surfaceColor);
  el.style.setProperty("--secondary-foreground", primaryColor);
  el.style.setProperty("--muted", shadeHex(surfaceColor, 0.04));
  el.style.setProperty("--accent", surfaceColor);
  el.style.setProperty("--accent-foreground", primaryColor);
  el.style.setProperty("--sidebar", shadeHex(surfaceColor, 0.02));
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
