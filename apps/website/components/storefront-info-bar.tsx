import { MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import Link from "next/link";

import { layoutSpacing } from "@/constants/spacing";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

import { InfoBarSameDay } from "./info-bar-same-day";
import type { StorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

/**
 * THE BAR ABOVE THE LOGO — the shop's own short lines on the left, its phone
 * and place on the right, on the brand colour. The shape the shop sent
 * (2026-10-23).
 *
 * Every word is the shop's: the lines and the place are typed in Admin →
 * Header, the phone is Settings → Contact. Nothing is shipped here, so a shop
 * that has written nothing gets no bar at all (`infoBar` is null then).
 *
 * INSIDE the sticky header, so it stays on screen while the page scrolls —
 * the shop's choice: the category band below is what steps aside on scroll.
 * `data-info-bar` lets the band's browser test subtract it from the header.
 */
export function StorefrontInfoBar({ bar }: { bar: NonNullable<StorefrontChrome["infoBar"]> }) {
  const telHref = `tel:${bar.phone.replace(/[^\d+]/g, "")}`;
  return (
    <div data-info-bar className="bg-bakery-800 text-white">
      <div
        /*
          THE PAGE'S COLUMN, the same one the logo and the icons sit in.

          It ran edge to edge (the shop's choice, 2026-10-23), which on a wide
          monitor put "Freshly Baked" at the window's left edge and the logo
          240px in from it — two left edges, one above the other. The shop
          asked for them to line up (2026-11-02). The brown still runs edge to
          edge; only the words moved in.
        */
        className={cn(
          layoutSpacing.container,
          "flex h-9 items-center justify-center gap-4 text-xs md:justify-between lg:h-10",
        )}
      >
        {bar.points.length > 0 || bar.sameDay ? (
          <ul
            /*
              TODAY'S DEADLINE FIRST, while there is one. A phone has room for
              one line, so while the deadline is showing it is that line — the
              `:has` rule hides the shop's first line beneath it, and when the
              window closes (the deadline then draws nothing at all) the shop's
              first line is back. Decided by what is on the page rather than by
              the server's reading, which may be minutes old.
            */
            className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap max-sm:[&:has([data-same-day])_[data-first-point]]:hidden"
          >
            {bar.sameDay ? (
              <InfoBarSameDay closesAt={bar.sameDay.closesAt} timeLeft={bar.sameDay.timeLeft} />
            ) : null}
            {bar.points.map((point, index) => (
              <li
                key={`${index}-${point}`}
                data-first-point={index === 0 ? "" : undefined}
                // A phone gets one line; the rest from sm — except on a
                // tablet, where the phone and WhatsApp share the row and the
                // third line ran into them ("100%" against "Order on
                // WhatsApp" at 768). They are back from lg.
                className={cn("items-center gap-3", index === 0 ? "flex" : "hidden sm:flex md:hidden lg:flex")}
              >
                {index > 0 ? <span aria-hidden="true" className="h-3.5 w-px bg-white/40" /> : null}
                {index === 0 ? <Truck aria-hidden="true" className="size-4 shrink-0 text-gold-200" /> : null}
                <span className="truncate">{point}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        {bar.whatsapp || bar.phone || bar.location ? (
          <div className="hidden shrink-0 items-center gap-3 md:flex">
            {/*
              WHATSAPP BESIDE THE PHONE — how most of this shop's customers
              would rather ask. The shop's own link from Settings → Social,
              never a number made up from the phone above.
            */}
            {bar.whatsapp ? (
              <a
                href={bar.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-semibold hover:underline"
              >
                <MessageCircle aria-hidden="true" className="size-4 text-gold-200" />
                Order on WhatsApp
              </a>
            ) : null}
            {bar.whatsapp && (bar.phone || bar.location) ? (
              // With no phone, what follows is the place — hidden on a tablet,
              // so its divider is too.
              <span aria-hidden="true" className={cn("h-3.5 w-px bg-white/40", !bar.phone && "hidden lg:block")} />
            ) : null}
            {bar.phone ? (
              <a href={telHref} className="flex items-center gap-1.5 hover:underline">
                <Phone aria-hidden="true" className="size-4 text-gold-200" />
                {bar.phone}
              </a>
            ) : null}
            {bar.phone && bar.location ? <span aria-hidden="true" className="hidden h-3.5 w-px bg-white/40 lg:block" /> : null}
            {bar.location ? (
              // From lg: on a tablet the place gave way so WhatsApp and the phone fit.
              <Link href={routes.store.contact} className="hidden items-center gap-1.5 hover:underline lg:flex">
                <MapPin aria-hidden="true" className="size-4 text-gold-200" />
                {bar.location}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
