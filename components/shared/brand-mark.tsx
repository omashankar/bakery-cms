"use client";

import { useState } from "react";
import { optimizedImageUrl } from "@/lib/image-url";

interface BrandMarkProps {
  /** An admin-typed URL, or "" for the letter badge. */
  logo: string;
  /** The badge's letter when there is no logo. Falls back to the name's initial. */
  logoLetter: string;
  /** The shop's name — the visible text beside the badge, and the logo's alt. */
  siteName: string;
  /**
   * "header" — the storefront's main bar, which is 84px tall on a desktop and
   * gives the logo room to be read. At the 50px every other place uses, a 3:1
   * wordmark came out 150px wide and its small line ("BAKERY") was a smudge.
   */
  size?: "default" | "header" | "footer" | "checkout";
}

/** The logo's drawn height and width cap, and the height asked of the CDN. */
const LOGO_SIZES = {
  // 48px on a phone (the row is 64px), 52 from sm, 64 in the 84px desktop
  // bar — the cart header's size, which the shop preferred to the 88px it was
  // (2026-10-24). `max-w-full` keeps it inside the link's own cap on a narrow
  // phone, where the cart and menu button share the row.
  header: { className: "h-12 max-w-full sm:h-[52px] lg:h-16 lg:max-w-[220px]", height: 64 },
  // The footer has room the checkout header does not; at 50px the badge
  // logo's ribbon lettering could not be read there.
  footer: { className: "h-16 max-w-[220px] lg:h-20 lg:max-w-[260px]", height: 80 },
  // The cart and checkout header: smaller than the shop header's 88px, so the
  // steps beside it keep their room, and readable rather than a 50px blot.
  checkout: { className: "h-12 max-w-[150px] md:h-16 md:max-w-[200px]", height: 64 },
  default: { className: "h-[50px] max-w-[200px]", height: 50 },
} as const;

/**
 * The shop's mark, wherever it appears.
 *
 * The header and the footer each drew this themselves, and drifted: the header
 * grew logo support and the footer never got it, so a shop that uploaded its
 * wordmark saw it at the top of the page and a letter badge at the bottom of
 * the same page. The footer also derived its letter from `siteName.charAt(0)`
 * instead of reading `logoLetter`, so the letter an admin typed in Appearance
 * reached one end of the page and not the other.
 *
 * The callers keep their own link and layout; only the mark itself lives here.
 * Props are plain strings rather than the chrome object because
 * `components/shared` may not import from an app.
 */
export function BrandMark({ logo, logoLetter, siteName, size = "default" }: BrandMarkProps) {
  const drawn = LOGO_SIZES[size];
  // An admin can point this anywhere, and anywhere can 404 — a stale path, a
  // deleted upload, a CDN that moved. A broken-image glyph is worse than the
  // letter mark it replaced, so fall back to it.
  const [logoBroken, setLogoBroken] = useState(false);

  const letter = logoLetter.trim() || siteName.trim().charAt(0).toUpperCase();

  if (logo && !logoBroken) {
    return (
      // An admin-typed URL on any host, so next/image is not usable here: it
      // would need every such host allow-listed in next.config remotePatterns,
      // and an un-listed one throws instead of rendering.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // Delivered at the height it is drawn at. Shops upload the file their
        // designer exported — measured here at 293 KB for a 50px-tall mark.
        src={optimizedImageUrl(logo, { height: drawn.height })}
        alt={siteName}
        onError={() => setLogoBroken(true)}
        // The logo is in the SERVER-rendered HTML, so a 404 can resolve before
        // the bundle has even downloaded — and React does not replay load/error
        // events that completed before hydration. The handler above would never
        // fire and the page would keep a broken-image glyph forever. This asks
        // the element directly.
        ref={(node) => {
          if (node?.complete && node.naturalWidth === 0) setLogoBroken(true);
        }}
        // A logo is usually a WORDMARK — the mark and the name in one wide
        // image — so it REPLACES the name rather than sitting beside it, and
        // gets its natural width at a bounded height. Capped, or a very wide
        // one pushes the nav off its row.
        className={`w-auto object-contain object-left ${drawn.className}`}
      />
    );
  }

  /*
    THE FALLBACK HAS TO FIT THE ROW THE LOGO WAS SIZED FOR. Every caller caps
    its link (144px on a phone in the header), and with no shrink rule the
    badge was squeezed and the name broke one word per line — three lines in a
    64px bar, spilling over the page. It shows whenever the logo cannot load,
    which on a phone with a poor connection is exactly when the shop most
    needs to look intact. So: the badge keeps its size, and the name takes at
    most two tight lines.
  */
  return (
    <>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bakery-700 shadow-sm">
        <span className="font-heading text-sm font-bold text-white">{letter}</span>
      </div>
      <span className="line-clamp-2 min-w-0 font-heading text-sm leading-tight font-bold tracking-tight text-foreground sm:text-lg">
        {siteName}
      </span>
    </>
  );
}
