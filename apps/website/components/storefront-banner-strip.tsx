"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getActiveHeroBanners } from "@/features/content/lib/banners-repository";
import { bannersLoaded } from "@/features/content/lib/content-api";
import { routes } from "@/constants/routes";
import type { Banner } from "@/types/media";

/**
 * Which page is this, in the terms the admin's Visibility field uses?
 *
 * The strip lives in the storefront layout shell, so it renders on every page —
 * but it asked for `"homepage"` banners wherever it was. A banner scoped to
 * "Homepage only" therefore appeared above the navbar on collections, product
 * pages, the cart, checkout and the account pages, and a banner scoped to
 * "Collections pages" was filtered out everywhere. Since the only other renderer
 * ignores visibility entirely, a collections banner rendered in exactly no place
 * at all while the admin's list showed it live.
 */
function visibilityForPath(pathname: string): Banner["visibility"] {
  if (pathname === routes.store.home) return "homepage";
  if (pathname.startsWith(routes.store.collections)) return "collections";
  return "all";
}

export function StorefrontBannerStrip() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    // Nothing until the server's banners have landed.
    //
    // `getActiveHeroBanners` reads the browser cache, and on a first visit that
    // cache does not exist — so it seeded the shipped demo banners and this strip
    // advertised "Summer Celebration Sale" to every first-time visitor, for their
    // whole session, on every page. It never re-read, so the real banners
    // arriving milliseconds later changed nothing. An empty strip is the honest
    // state until the shop's own answer is in.
    void bannersLoaded.waitForSettled().then((settled) => {
      if (settled && !cancelled) setBanners(getActiveHeroBanners(visibilityForPath(pathname)));
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  if (dismissed || banners.length === 0) return null;

  const banner = banners[index];
  if (!banner) return null;

  const content = (
    <div className="relative flex items-center gap-3 bg-bakery-700 px-4 py-2.5 text-sm text-white">
      <div className="relative size-8 shrink-0 overflow-hidden rounded-md border border-white/20">
        <OptimizedImage src={banner.image} alt="" fill className="object-cover" sizes="32px" />
      </div>
      <p className="min-w-0 flex-1 truncate font-medium">{banner.title}</p>
      {banner.link ? <span className="hidden text-xs underline sm:inline">View offer</span> : null}
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDismissed(true);
        }}
        className="rounded-md p-1 hover:bg-white/10"
        aria-label="Dismiss banner"
      >
        <X className="size-4" />
      </button>
    </div>
  );

  if (banner.link) {
    return (
      <Link href={banner.link} className="block transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}
