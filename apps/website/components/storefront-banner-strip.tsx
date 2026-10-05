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

/**
 * The live banners this route may show, out of all the live ones.
 *
 * NOT `selectActiveHeroBanners`, deliberately. That one re-checks each
 * banner's schedule against the clock, and this runs during the server render
 * AND again on hydration -- microseconds apart, but a banner starting in that
 * gap would be in the HTML and not in the hydration, which is the mismatch
 * this whole change exists to remove. The schedule is already settled:
 * `getPublicContent` returns live banners only. What is left is the position
 * and the route, and neither reads the clock.
 */
function forThisRoute(live: Banner[], pathname: string): Banner[] {
  const visibility = visibilityForPath(pathname);
  return live
    .filter((banner) => {
      if (banner.position !== "hero") return false;
      const scope = banner.visibility ?? "all";
      return scope === "all" || scope === visibility;
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.title.localeCompare(b.title));
}

interface StorefrontBannerStripProps {
  /**
   * Every live hero banner, read on the SERVER.
   *
   * This is what stops the strip arriving late. It used to start empty and
   * render nothing until the browser's copy settled, so a 52px bar appeared
   * above the header about 450ms after the page had painted and pushed the
   * whole page down -- CLS 0.306 on the homepage, 0.545 on the wishlist, on
   * the production build.
   */
  live: Banner[];
}

export function StorefrontBannerStrip({ live }: StorefrontBannerStripProps) {
  const pathname = usePathname();
  /*
    THE SERVER'S ANSWER UNTIL THE BROWSER HAS A BETTER ONE.

    `null` means "nothing has arrived from the browser yet" and is NOT the
    same as an empty list, which is a real answer meaning this route shows no
    banner. Starting from `[]` is what made the bar late in the first place.
  */
  const [fromBrowser, setFromBrowser] = useState<Banner[] | null>(null);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const banners = fromBrowser ?? forThisRoute(live, pathname);

  useEffect(() => {
    let cancelled = false;

    // STILL HERE, and still for its original reason.
    //
    // `getActiveHeroBanners` reads the browser cache, and on a first visit that
    // cache does not exist — so it seeded the shipped demo banners and this strip
    // advertised "Summer Celebration Sale" to every first-time visitor, for their
    // whole session, on every page. Waiting for the settled answer is what fixed
    // that, and it is why this cannot simply read the cache on first render.
    //
    // What changed is that waiting no longer decides the FIRST paint: the
    // server's list does, so there is nothing to push down when this lands. It
    // now exists to pick up a banner the admin changed mid-session, and to
    // re-narrow the list on a client-side navigation.
    void bannersLoaded.waitForSettled().then((settled) => {
      if (settled && !cancelled) setFromBrowser(getActiveHeroBanners(visibilityForPath(pathname)));
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
