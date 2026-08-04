"use client";

import { setActiveLocale } from "@/features/settings/lib/active-locale";

interface LocaleSyncProps {
  currency: string;
  timezone: string;
}

/**
 * Publishes the store's currency and timezone into the CLIENT module graph.
 *
 * Client components are rendered on the server too, and when they are, they run
 * from the client bundle — a different copy of every module than the one the
 * root layout touches. So the layout setting the locale is only half the job:
 * without this, `formatCurrency` inside a product card renders the fallback
 * during SSR and the real currency after hydration, which is a mismatch on
 * every price in the app.
 *
 * Set during render, not in an effect: an effect runs after the first paint, by
 * which point the wrong currency is already in the HTML and already hydrated.
 * The write is idempotent — the same two values for the whole request — so
 * re-rendering it costs nothing and cannot tear.
 *
 * Rendered above everything that formats, so the value is in place before the
 * first price is turned into a string.
 */
export function LocaleSync({ currency, timezone }: LocaleSyncProps) {
  setActiveLocale(currency, timezone);
  return null;
}
