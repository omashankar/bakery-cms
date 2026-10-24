/**
 * ONE SIZE FOR EVERY ACTION ON THE ACCOUNT PAGES — Save, Cancel, Change photo,
 * View details, Reorder, Edit, Remove. They were 44, 40, 36 and 28px tall on
 * the three pages, with the design system's tight default padding, so the same
 * kind of button looked different on every screen.
 */
export const ACCOUNT_ACTION = "h-10 gap-2 px-4";

/**
 * A card's closing band of actions, drawn edge to edge from inside a body
 * padded `p-5 sm:p-6` — the same band the order cards end with. Its small top
 * margin assumes a `space-y-*` form above it, which spaces it already.
 */
export const ACCOUNT_CARD_FOOTER =
  "-mx-5 -mb-5 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-cream-50/70 px-5 py-3 sm:-mx-6 sm:-mb-6 sm:px-6";

/**
 * The shared EmptyState, drawn as a card. Its own grey dashed box stood out on
 * these pages as the one thing not drawn like the cards around it.
 */
export const ACCOUNT_EMPTY_CARD = "rounded-2xl border-solid bg-card py-14 shadow-sm";
