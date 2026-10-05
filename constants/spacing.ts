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
   * Twenty-odd pages draw from this. It was `py-16 sm:py-20 lg:py-24`, on the
   * reasoning that each of them is one subject and wants air around it — and
   * that reasoning survived the thing that actually decides the number, which
   * is what sits directly above.
   *
   * WHAT SITS ABOVE IS THE BREADCRUMB TRAIL. Every one of these pages is
   * headed by a thin trail and nothing else; the band and the page title that
   * used to fill that space were taken out. So the 96px was no longer air
   * around a heading, it was a gap between a trail and the first thing on the
   * page — measured at 1440, the trail ended at 178 and the first product card
   * began at 475, nearly three hundred pixels of white on a catalogue page.
   *
   * The product page was brought to this rhythm on its own and the number
   * below is the one that was settled there: 24 at the top, 32 from `lg`, and
   * 64 at the foot before the footer. Written here rather than repeated as an
   * override on every page, because an override has to be remembered — and the
   * proof that it will not be is that for months exactly one page carried it.
   *
   * The homepage does not draw from this: it is a stack of twenty bands, and
   * its rhythm is `bandY` below.
   */
  sectionY: "pt-6 pb-16 lg:pt-8",
  /**
   * ONE BAND of a homepage that has twenty of them.
   *
   * Measured against the storefront this one is drawn from: its rows sit
   * about 32px apart, and ours sat at 96px — so a page with the same number
   * of rows was half as long again, and every row read as its own screen
   * rather than as part of a catalogue.
   *
   * WHAT THIS NUMBER ACTUALLY CONTROLS is twice itself. Bands sit flush —
   * measured at 1440px, every one of the twenty had a zero margin to its
   * neighbour — so the white between two rows is this padding on the bottom
   * of one plus the same on the top of the next. At `lg:py-8` that read as
   * 64px of nothing between every row, which is the gap the shop kept
   * pointing at. `lg:py-6` makes it 48.
   *
   * 96 first, then 32/40/48, then 24/32/40, then 20/24/32, then this. Each
   * step was the shop looking at the page and asking for closer.
   */
  bandY: "py-4 sm:py-5 lg:py-6",
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
