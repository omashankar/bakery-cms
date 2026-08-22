import type { AppearanceSettings } from "@/types/appearance";

/**
 * The shop palette, as domain logic.
 *
 * This lived in `apps/admin/appearance/lib/appearance-utils.ts`, which was fine
 * while only the admin applied it to the DOM. The storefront now renders the
 * palette on the SERVER so the customer's first paint is the shop's own — and
 * the customer website may not import from `apps/admin`. Neither may
 * `features/site-layout/server`, which seeds the store from these defaults.
 *
 * So the parts everyone needs — the defaults, the colour arithmetic and the
 * token map — live here. One implementation, because two copies of this
 * arithmetic is exactly how a server-rendered palette and a client-applied one
 * drift into disagreeing.
 *
 * The rest of that module has since followed it: `appearance-utils.ts` and
 * `appearance-repository.ts` are neighbours in this directory now. The half
 * that moved first was the half the SERVER needed; what kept the other half in
 * apps/admin was only that the admin had written it, and components/shared was
 * reaching across for it to paint the storefront.
 */

export const defaultAppearanceSettings: AppearanceSettings = {
  preset: "classic",
  primaryColor: "#6f4e37",
  accentColor: "#d4a373",
  surfaceColor: "#faf8f4",
  borderRadius: 12,
};

/**
 * Marks a page whose palette the SERVER already painted.
 *
 * `AppearanceThemeSync` checks for it before applying the localStorage copy:
 * a visitor on their FIRST load has no cache, and `loadAppearanceSettings`
 * answers with the DEFAULTS — which would be painted straight over correct
 * server-rendered values. That would turn a flash of the default palette into
 * a flash of the WRONG one, which is worse.
 */
export const APPEARANCE_SSR_STYLE_ID = "appearance-tokens";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * A bad TYPE, not just a bad value.
 *
 * These both called `.trim()` on the argument, which throws when a stored
 * colour is `null` rather than a malformed string — and `hasValidAppearanceColors`
 * is the guard `appearanceCssVariables` relies on to "return nothing for a
 * palette it cannot use". Instead of returning nothing it threw, and on the
 * storefront that throw is caught by `getStorefrontChrome`, which answers with
 * `fallbackChrome()`: the demo brand, the demo nav, the demo footer and the demo
 * contact details on EVERY page, because one colour field held the wrong type.
 *
 * Confirmed live. `"not-a-colour"` degraded correctly — the palette dropped and
 * the shop's own header and footer survived — while `null` took the lot. The
 * schema refuses both on the way in now, but it only constrains FUTURE writes,
 * and the comment at the call site already says a row at rest "can hold a colour
 * that was allowed in years earlier".
 */
export function isValidHexColor(value: string): boolean {
  return typeof value === "string" && HEX_COLOR.test(value.trim());
}

export function normalizeHexColor(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return trimmed;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function hasValidAppearanceColors(settings: AppearanceSettings): boolean {
  return (
    isValidHexColor(settings.primaryColor) &&
    isValidHexColor(settings.accentColor) &&
    isValidHexColor(settings.surfaceColor)
  );
}

/** Lighten toward white by amount 0–1. */
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
 * The Appearance tokens as plain data, so the SERVER can render them too.
 *
 * This existed only as a sequence of `el.style.setProperty` calls, which meant
 * the palette could not be written into the HTML — and nothing did. The
 * storefront painted the hardcoded defaults from `globals.css`, which happen to
 * be byte-identical to the demo preset, until a client fetch resolved and
 * repainted. A shop on the default palette never noticed; a shop that picked
 * its own colours showed every visitor the demo brown first, on every cold
 * load.
 *
 * Empty when the colours are not usable: the caller then leaves the CSS
 * defaults in place rather than writing half a palette.
 */
export function appearanceCssVariables(
  settings: AppearanceSettings,
  options?: ApplyAppearanceOptions
): Record<string, string> {
  if (!hasValidAppearanceColors(settings)) return {};

  const primaryColor = normalizeHexColor(settings.primaryColor);
  const accentColor = normalizeHexColor(settings.accentColor);
  const surfaceColor = normalizeHexColor(settings.surfaceColor);
  const borderRadius = settings.borderRadius === 16 ? 16 : 12;

  const brand: Record<string, string> = {
    "--brand-primary": primaryColor,
    "--bakery-700": primaryColor,
    "--bakery-600": mixHex(primaryColor, 0.08),
    "--bakery-500": mixHex(primaryColor, 0.18),
    "--bakery-800": shadeHex(primaryColor, 0.12),
    "--bakery-900": shadeHex(primaryColor, 0.22),

    "--brand-accent": accentColor,
    "--gold-300": accentColor,
    "--gold-400": accentColor,
    "--gold-500": shadeHex(accentColor, 0.08),

    "--surface-cream": surfaceColor,
    "--cream-50": "#ffffff",
    "--cream-100": surfaceColor,
    "--cream-200": shadeHex(surfaceColor, 0.04),
    "--beige": shadeHex(surfaceColor, 0.06),

    "--radius": `${borderRadius}px`,
  };

  if (options?.forceSemantics === false) return brand;

  return {
    ...brand,
    "--primary": primaryColor,
    "--primary-foreground": "#ffffff",
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": "#ffffff",
    "--ring": accentColor,
    "--sidebar-ring": accentColor,
    "--secondary": surfaceColor,
    "--secondary-foreground": primaryColor,
    "--muted": shadeHex(surfaceColor, 0.04),
    "--accent": surfaceColor,
    "--accent-foreground": primaryColor,
    "--sidebar": shadeHex(surfaceColor, 0.02),
  };
}
