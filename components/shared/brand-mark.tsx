"use client";

import { useState } from "react";

interface BrandMarkProps {
  /** An admin-typed URL, or "" for the letter badge. */
  logo: string;
  /** The badge's letter when there is no logo. Falls back to the name's initial. */
  logoLetter: string;
  /** The shop's name — the visible text beside the badge, and the logo's alt. */
  siteName: string;
}

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
export function BrandMark({ logo, logoLetter, siteName }: BrandMarkProps) {
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
        src={logo}
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
        className="h-[50px] w-auto max-w-[200px] object-contain object-left"
      />
    );
  }

  return (
    <>
      <div className="flex size-9 items-center justify-center rounded-xl bg-bakery-700 shadow-sm">
        <span className="font-heading text-sm font-bold text-white">{letter}</span>
      </div>
      <span className="font-heading text-lg font-bold tracking-tight text-foreground">
        {siteName}
      </span>
    </>
  );
}
