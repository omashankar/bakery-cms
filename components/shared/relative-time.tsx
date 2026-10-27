"use client";

import { useSyncExternalStore } from "react";

import { formatRelativeTime } from "@/utils/format";

const emptySubscribe = () => () => {};

/**
 * "3m ago", said without a hydration error.
 *
 * The words depend on the moment they are read, and the server's HTML and the
 * browser's first render are two moments. Usually a second apart — enough to
 * cross "59m" into "1h" — and sometimes a night apart: a tab restored in the
 * morning hydrates yesterday's "3m ago" as "15h ago" (admin products list,
 * 2026-10-27). React then throws the page's tree away and renders it again.
 *
 * So the HTML keeps the server's words (the mismatch is expected, and
 * silenced on this one element only), and once hydrated the element is
 * remounted with the browser's — `suppressHydrationWarning` alone would keep
 * the stale text on screen. A page reached by client navigation renders the
 * browser's words straight away.
 */
export function RelativeTime({ date }: { date: string | Date }) {
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const at = new Date(date);
  return (
    <time
      key={hydrated ? "browser" : "server"}
      dateTime={Number.isNaN(at.getTime()) ? undefined : at.toISOString()}
      suppressHydrationWarning
    >
      {formatRelativeTime(date)}
    </time>
  );
}
