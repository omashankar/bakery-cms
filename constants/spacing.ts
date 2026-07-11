/**
 * Bakery CMS — 8px Spacing System
 */

export const spacing = {
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  11: "44px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px",
  24: "96px",
  28: "112px",
  32: "128px",
  36: "144px",
  40: "160px",
  44: "176px",
  48: "192px",
  52: "208px",
  56: "224px",
  60: "240px",
  64: "256px",
  72: "288px",
  80: "320px",
  96: "384px",
} as const;

/** Semantic layout spacing */
export const layoutSpacing = {
  sectionY: "py-16 sm:py-20 lg:py-24",
  sectionX: "px-4 sm:px-6 lg:px-8",
  container: "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
  containerNarrow: "mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8",
  containerWide: "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8",
  cardPadding: "p-6",
  cardPaddingSm: "p-4",
  stackSm: "space-y-2",
  stack: "space-y-4",
  stackLg: "space-y-6",
  stackXl: "space-y-8",
  inlineSm: "gap-2",
  inline: "gap-4",
  inlineLg: "gap-6",
} as const;

export type SpacingKey = keyof typeof spacing;
