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
  /**
   * A WHOLE PAGE of something — checkout, the cart, a product, a CMS page.
   *
   * Twenty-odd pages draw from this, and they are each one subject with air
   * around it. The homepage is not: it is a stack of twenty bands, and at
   * this rhythm it ran to 11,325px with 96px of nothing between every row.
   * That band spacing is `bandY` below.
   */
  sectionY: "py-16 sm:py-20 lg:py-24",
  /**
   * ONE BAND of a homepage that has twenty of them.
   *
   * Measured against the storefront this one is drawn from: its rows sit
   * about 32px apart, and ours sat at 96px — so a page with the same number
   * of rows was half as long again, and every row read as its own screen
   * rather than as part of a catalogue.
   *
   * 96 first, then 32/40/48, then 24/32/40, then this. Each step was the
   * shop looking at the page and asking for closer.
   */
  bandY: "py-5 sm:py-6 lg:py-8",
  sectionX: "px-4 sm:px-6 lg:px-8",
  /**
   * THE CONTENT COLUMN — 1440, not `max-w-7xl`'s 1280.
   *
   * Measured against the layout this storefront is drawn from: its rows of
   * category tiles span about 1520px of a 1900px window, and at 1280 ours
   * stopped 150px short on each side, so a strip meant to read as the way
   * into the catalogue looked like a narrow panel floating in white.
   *
   * A CHANGE TO EVERY PAGE, deliberately: the header, the nav band, the
   * grids, the cart and the checkout all draw their column from here, and
   * widening one of them alone is how a page stops lining up with its own
   * header. Text is not affected — every block of prose in this repo carries
   * its own narrower max-width (SectionHeader's `max-w-2xl`, and
   * `containerNarrow` for whole pages of it), which is what makes widening
   * this safe.
   */
  container: "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8",
  containerNarrow: "mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8",
  // Still the wide one, and still wider than `container` — it was 1400,
  // which the line above has just overtaken.
  containerWide: "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8",
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
