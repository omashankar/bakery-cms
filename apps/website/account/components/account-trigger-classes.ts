/**
 * The header's account buttons, in ONE place.
 *
 * Each is drawn twice: the stand-in in lazy-account-menus that every page
 * paints first, and the real dropdown trigger that replaces it on the first
 * hover or tap. They were two copies of the same class string, so restyling
 * one left the other — the guest button turned into a round mark and the
 * stand-in went on saying "Login" in text until somebody pointed at it.
 */

/** A round mark with a person in it — what a visitor who is not signed in sees. */
export const GUEST_TRIGGER_CLASS =
  "flex size-10 items-center justify-center rounded-full bg-bakery-700 text-white shadow-sm outline-none transition-premium hover:bg-bakery-800 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 data-[popup-open]:bg-bakery-800 lg:size-12";

/** The same circle, holding a signed-in customer's initials. */
export const ACCOUNT_TRIGGER_CLASS =
  "flex size-10 items-center justify-center rounded-full bg-bakery-700 text-xs font-bold text-white shadow-sm outline-none transition-premium hover:bg-bakery-800 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 data-[popup-open]:bg-bakery-800 lg:size-12 lg:text-sm";

/** The person icon inside the guest mark. */
export const GUEST_ICON_CLASS = "size-5 lg:size-6";
