import { MapPin, Phone, Truck } from "lucide-react";
import Link from "next/link";

import { routes } from "@/constants/routes";
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
          FULL WIDTH, edge to edge — not the page's centred column. The shop
          asked for the bar at 100%: its lines start at the window's left and
          the phone and place sit at its right, on every screen size.
        */
        className="flex h-9 w-full items-center justify-center gap-4 px-4 text-xs sm:px-6 md:justify-between lg:h-10 lg:px-8"
      >
        {bar.points.length > 0 ? (
          <ul className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap">
            {bar.points.map((point, index) => (
              <li
                key={`${index}-${point}`}
                // A phone gets the first line only; the rest from sm.
                className={`items-center gap-3 ${index === 0 ? "flex" : "hidden sm:flex"}`}
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
        {bar.phone || bar.location ? (
          <div className="hidden shrink-0 items-center gap-3 md:flex">
            {bar.phone ? (
              <a href={telHref} className="flex items-center gap-1.5 hover:underline">
                <Phone aria-hidden="true" className="size-4 text-gold-200" />
                {bar.phone}
              </a>
            ) : null}
            {bar.phone && bar.location ? <span aria-hidden="true" className="h-3.5 w-px bg-white/40" /> : null}
            {bar.location ? (
              <Link href={routes.store.contact} className="flex items-center gap-1.5 hover:underline">
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
