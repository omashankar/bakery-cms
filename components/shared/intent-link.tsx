"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A `<Link>` that prefetches when the person shows they might follow it —
 * pointer over it, focus on it, a finger on it — instead of the moment it is
 * on screen.
 *
 * The admin sidebar is fifteen links that are ALL on screen on every page, so
 * the default prefetched fifteen routes (thirty requests, measured on a
 * production build) while the page the admin had actually opened was still
 * fetching its own data from the same server. "View Storefront" alone pulled
 * the shop's homepage renderer and navbar into every admin visit.
 *
 * Intent is still well ahead of the click: hover to click is a few hundred
 * milliseconds, which is what a prefetch needs. The pattern is the one the
 * Next.js docs give ("HoverPrefetchLink"), widened to focus and touch so a
 * keyboard and a phone get it too.
 */
export function IntentLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
