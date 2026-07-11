/**
 * Bakery CMS — Brand Color Palette (Phase 3)
 * White · Cream · Beige · Brown Primary · Gold Accent
 */

export const brandColors = {
  white: "#FFFFFF",
  cream: "#FAF8F4",
  beige: "#F5F2EC",
  primary: "#6F4E37",
  secondary: "#8B5E3C",
  accent: "#D4A373",
  border: "#E8E5DF",
  text: "#2D2D2D",
  textMuted: "#6B6B6B",
} as const;

export const bakeryColors = {
  brown: {
    50: "#FAF8F6",
    100: "#F0EBE4",
    200: "#E0D4C8",
    300: "#C9B09A",
    400: "#A88468",
    500: "#8B5E3C",
    600: "#7A5235",
    700: "#6F4E37",
    800: "#5A3F2B",
    900: "#4A3324",
    950: "#2D1F16",
  },
  cream: {
    50: "#FFFFFF",
    100: "#FAF8F4",
    200: "#F5F2EC",
    300: "#EBE6DC",
    400: "#DDD5C8",
    500: "#CFC4B4",
  },
  gold: {
    50: "#FAF6F1",
    100: "#F3EBE0",
    200: "#E8D9C4",
    300: "#D4A373",
    400: "#D4A373",
    500: "#C49363",
    600: "#A87A4F",
    700: "#8C6440",
    800: "#6F4F32",
    900: "#523B25",
  },
  neutral: {
    50: "#FAFAF9",
    100: "#F5F5F4",
    200: "#E8E5DF",
    300: "#D6D3D1",
    400: "#A8A29E",
    500: "#78716C",
    600: "#6B6B6B",
    700: "#44403C",
    800: "#2D2D2D",
    900: "#1C1917",
    950: "#0C0A09",
  },
  semantic: {
    success: "#16A34A",
    successLight: "#DCFCE7",
    warning: "#D97706",
    warningLight: "#FEF3C7",
    error: "#DC2626",
    errorLight: "#FEE2E2",
    info: "#2563EB",
    infoLight: "#DBEAFE",
  },
} as const;

/** Semantic surface hexes for documentation only — runtime shells use CSS theme tokens. */
export const surfaces = {
  page: brandColors.white,
  section: brandColors.cream,
  sidebar: brandColors.beige,
  card: brandColors.white,
  cardAlt: brandColors.cream,
} as const;

export type BakeryColorScale = keyof typeof bakeryColors;
export type BakeryBrownShade = keyof typeof bakeryColors.brown;
