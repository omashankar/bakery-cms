import { User } from "lucide-react";

import { AccountAvatarFace } from "./account-avatar";

/**
 * The header's account button, in ONE place.
 *
 * Each is drawn twice: the stand-in in lazy-account-menus that every page
 * paints first, and the real dropdown trigger that replaces it on the first
 * hover or tap. They were two copies of the same markup, so restyling one
 * left the other — the guest button turned into a round mark and the
 * stand-in went on saying "Login" in text until somebody pointed at it.
 *
 * JUST THE ROUND MARK — the customer's initials, or a person for a visitor.
 * The shop tried a name beside it and a ring on hover and chose the plain
 * circle (2026-10-24); the full name and phone are in the menu it opens.
 * Hover deepens the circle's own colour, nothing around it.
 */
export const ACCOUNT_TRIGGER_CLASS =
  "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bakery-700 text-xs font-bold text-white shadow-sm outline-none transition-premium hover:bg-bakery-900 focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 data-[popup-open]:bg-bakery-900";

export function AccountTriggerFace({ name, avatarUrl }: { name: string | null; avatarUrl?: string }) {
  if (name === null) return <User className="size-5" aria-hidden />;
  return <AccountAvatarFace name={name} avatarUrl={avatarUrl} size={36} />;
}
