"use client";

import { useState } from "react";
import { optimizedImageUrl } from "@/lib/image-url";

interface AppBrandImageProps {
  src: string;
  /** Drawn instead when the image cannot load. */
  letter: string;
  /** The shop's name — the image is decorative beside it, so this is only a title. */
  name: string;
}

/**
 * The square badge as a picture, with the letter as its safety net.
 *
 * Kept apart from `app-brand.tsx` on purpose: this needs client state for the
 * error fallback, and `AppBrand` is rendered by a SERVER component (the
 * architecture hub). Putting `"use client"` on the whole brand file would make
 * a client boundary out of a block that is otherwise static everywhere it is
 * used. The boundary exists only where a picture actually does.
 */
export function AppBrandImage({ src, letter, name }: AppBrandImageProps) {
  // An admin can point this anywhere, and anywhere can 404 — a stale path, a
  // deleted upload, a CDN that moved. A broken-image glyph in the panel's own
  // header is worse than the letter it replaced.
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <span className="font-heading text-sm font-bold text-primary-foreground">
        {letter}
      </span>
    );
  }

  return (
    // An admin-typed URL on any host, so next/image is not usable here: it
    // would need every such host allow-listed in next.config remotePatterns,
    // and an un-listed one throws instead of rendering.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A 32px badge. The shop's favicon is usually the largest square it has.
      src={optimizedImageUrl(src, { width: 32 })}
      alt=""
      title={name}
      onError={() => setBroken(true)}
      // A 404 can resolve before the bundle has downloaded, and React does not
      // replay load/error events that completed before hydration — so the
      // handler above would never fire. This asks the element directly.
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setBroken(true);
      }}
      className="size-full object-cover"
    />
  );
}
