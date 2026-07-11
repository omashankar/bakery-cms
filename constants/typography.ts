/**
 * Bakery CMS — Typography Scale
 * 8px-based rhythm with premium SaaS hierarchy
 */

export const fontFamilies = {
  sans: "var(--font-sans)",
  heading: "var(--font-heading)",
  mono: "var(--font-mono)",
} as const;

export const fontSizes = {
  xs: { size: "0.75rem", lineHeight: "1rem" },
  sm: { size: "0.875rem", lineHeight: "1.25rem" },
  base: { size: "1rem", lineHeight: "1.5rem" },
  lg: { size: "1.125rem", lineHeight: "1.75rem" },
  xl: { size: "1.25rem", lineHeight: "1.75rem" },
  "2xl": { size: "1.5rem", lineHeight: "2rem" },
  "3xl": { size: "1.875rem", lineHeight: "2.25rem" },
  "4xl": { size: "2.25rem", lineHeight: "2.5rem" },
  "5xl": { size: "3rem", lineHeight: "1.15" },
  "6xl": { size: "3.75rem", lineHeight: "1.1" },
  "7xl": { size: "4.5rem", lineHeight: "1.05" },
} as const;

export const fontWeights = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

/** Tailwind class presets for consistent typography */
export const typographyPresets = {
  display: "font-heading text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl",
  h1: "font-heading text-4xl font-bold tracking-tight sm:text-5xl",
  h2: "font-heading text-3xl font-semibold tracking-tight sm:text-4xl",
  h3: "font-heading text-2xl font-semibold tracking-tight",
  h4: "font-heading text-xl font-semibold tracking-tight",
  h5: "font-heading text-lg font-semibold",
  h6: "font-heading text-base font-semibold",
  body: "text-base leading-relaxed text-muted-foreground",
  bodyLg: "text-lg leading-relaxed text-muted-foreground",
  caption: "text-sm text-muted-foreground",
  overline: "text-xs font-semibold uppercase tracking-widest text-muted-foreground",
  label: "text-sm font-medium leading-none",
} as const;
