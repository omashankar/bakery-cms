"use client";

import { Clock } from "lucide-react";

import { countdownParts } from "@/features/orders/lib/delivery-date";
import { useSameDayCountdown } from "@/hooks/use-same-day-countdown";

/**
 * "Order in 2h 15m for same-day delivery" — the shop's own deadline, in the
 * bar above every page.
 *
 * TO THE MINUTE, AND THE SAME COLOUR ALL DAY. The homepage band runs its
 * seconds because the shop asked to see that clock move; a line in the
 * header a customer reads past on every page is a fact, not a clock to watch,
 * and it never grows or reddens as the window closes (see the note in
 * same-day-countdown-section.tsx). Once the window has closed it draws
 * NOTHING — not its item, not the divider after it — so the shop's own lines
 * close up behind it; a deadline that has passed is not news.
 *
 * The server's first reading is the first render, so the HTML and the first
 * paint agree; the hook takes over from the next tick.
 */
export function InfoBarSameDay({ closesAt, timeLeft }: { closesAt: string; timeLeft: string | null }) {
  const parts = countdownParts(useSameDayCountdown(closesAt, timeLeft));
  if (!parts) return null;

  const hours = Number(parts.hours);
  const minutes = Number(parts.minutes);
  const left = hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m` : "under a minute";

  return (
    // `data-same-day` lets the list hide the shop's first line on a phone
    // while this one is showing — a phone has room for one.
    <li data-same-day className="flex items-center gap-3">
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden="true" className="size-4 shrink-0 text-gold-200" />
        <span className="truncate">
          Order in <span className="font-semibold">{left}</span> for same-day delivery
        </span>
      </span>
      <span aria-hidden="true" className="hidden h-3.5 w-px bg-white/40 sm:block" />
    </li>
  );
}
