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

/**
 * THE INK THAT CAN BE READ ON A GIVEN FILL.
 *
 * `--primary-foreground` was the literal `"#ffffff"`, welded to whatever
 * `primaryColor` the shop had picked, and nothing anywhere in this pipeline
 * looked at how light that colour was. Measured in a browser on the real
 * storefront button:
 *
 *   the shipped brown #6f4e37   white on it   7.44:1   fine
 *   a pale mint      #a8e6cf   white on it   1.41:1   invisible
 *   a pale yellow    #ffe66d   white on it   1.25:1   invisible
 *
 * 4.5:1 is the line at which body text is considered readable. A shop that
 * picks a pale brand colour — the most likely thing a shop that does not
 * sell cakes does — gets an Add to Cart button with no words on it, and the
 * Appearance preview shows the same unreadable button, so it reads as
 * intended rather than broken.
 *
 * So the ink is CHOSEN rather than assumed: white or the page's own dark,
 * whichever the eye can actually read. Not exposed as a setting, because a
 * picker would only let an owner choose wrong twice.
 */
const DARK_INK = "#2d2d2d";

/** WCAG relative luminance, sRGB. 0 is black, 1 is white. */
function relativeLuminance(hex: string): number {
  const normalized = normalizeHexColor(hex).replace("#", "");
  if (normalized.length !== 6) return 0;
  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return 0;
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((num >> 16) & 255);
  const g = channel((num >> 8) & 255);
  const b = channel(num & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableInkOn(fill: string): string {
  return contrastRatio("#ffffff", fill) >= contrastRatio(DARK_INK, fill)
    ? "#ffffff"
    : DARK_INK;
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

  /*
    THE WHOLE RAMP, not five steps of it.

    This wrote 5 of the 11 `--bakery-*` steps and 3 of the 8 `--gold-*` ones,
    and the storefront names the missing ones 45 times — `bakery-300` alone
    22 times. A shop that picked a colour therefore got a chip whose fill
    moved and whose edge did not, or a badge two thirds recoloured and one
    third still warm cream. The ramp has to be complete or it splits.

    The amounts are chosen so the SHIPPED brown lands within a unit or two of
    the values `globals.css` already hardcodes, which is how a shop on the
    default palette sees no change at all from this.
  */
  const brand: Record<string, string> = {
    "--brand-primary": primaryColor,
    "--bakery-50": mixHex(primaryColor, 0.96),
    "--bakery-100": mixHex(primaryColor, 0.88),
    "--bakery-200": mixHex(primaryColor, 0.75),
    "--bakery-300": mixHex(primaryColor, 0.55),
    "--bakery-400": mixHex(primaryColor, 0.3),
    "--bakery-500": mixHex(primaryColor, 0.18),
    "--bakery-600": mixHex(primaryColor, 0.08),
    "--bakery-700": primaryColor,
    "--bakery-800": shadeHex(primaryColor, 0.12),
    "--bakery-900": shadeHex(primaryColor, 0.22),
    "--bakery-950": shadeHex(primaryColor, 0.6),

    "--brand-accent": accentColor,
    "--gold-50": mixHex(accentColor, 0.9),
    "--gold-100": mixHex(accentColor, 0.78),
    "--gold-200": mixHex(accentColor, 0.55),
    "--gold-300": accentColor,
    "--gold-400": accentColor,
    "--gold-500": shadeHex(accentColor, 0.08),
    "--gold-600": shadeHex(accentColor, 0.25),
    "--gold-700": shadeHex(accentColor, 0.365),
    "--gold-800": shadeHex(accentColor, 0.52),
    "--gold-900": shadeHex(accentColor, 0.64),

    "--surface-cream": surfaceColor,
    /*
      STILL WHITE BY DECREE, and deliberately.

      `the-nav-band-is-a-band` pins this in both the stylesheet and here,
      because the nav band was once filled with it and went white on white.
      The token MEANS white. Anything that wanted a tint and reached for it
      was reaching for the wrong one.
    */
    "--cream-50": "#ffffff",
    "--cream-100": surfaceColor,
    "--cream-200": shadeHex(surfaceColor, 0.04),
    "--beige": shadeHex(surfaceColor, 0.06),

    "--radius": `${borderRadius}px`,
  };

  if (options?.forceSemantics === false) return brand;

  return {
    ...brand,
    /*
      THE GROUND THE PAGE IS DRAWN ON.

      `--background` and `--card` were fixed `#ffffff`, and the storefront
      shell's own class was the literal `bg-white` — on the very element
      that carries this palette inline. 16 of the 25 section types default
      to a white band, so the majority of the page's height was a colour no
      shop setting could reach. Measured in a browser with a deliberately
      alien palette applied: of nine surfaces on the redesigned homepage,
      exactly one moved.

      Lightened 80% toward white rather than set TO the surface, because the
      ground and the tinted band have to stay apart: `--cream-100` is the
      surface itself, and if the ground were too, every band boundary on the
      page would vanish. At the shipped cream this lands on #fefefd, a unit
      off the white it replaces.
    */
    "--background": mixHex(surfaceColor, 0.8),
    "--card": mixHex(surfaceColor, 0.8),
    "--popover": mixHex(surfaceColor, 0.8),
    /*
      THE HAIRLINE ROUND EVERYTHING.

      `--border` was fixed #e8e5df — a warm beige — and `globals.css` applies
      `border-border` to `*` in the base layer, so it is the outline of every
      tile, card, panel and row in the shop whether or not a class names it.
      A cool-grey surface with a warm hairline round it is the exact
      mismatch the category tile's own comment says destroys the object.

      Derived from the SURFACE rather than the brand, because a hairline's
      job is to be just visible against the thing it sits on — and a pale
      brand colour lightened toward white would disappear entirely.
    */
    "--border": shadeHex(surfaceColor, 0.08),
    "--input": shadeHex(surfaceColor, 0.08),
    "--border-soft": shadeHex(surfaceColor, 0.08),
    "--primary": primaryColor,
    "--primary-foreground": readableInkOn(primaryColor),
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": readableInkOn(primaryColor),
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
