"use client";

import { useEffect } from "react";
import { hydrateOnce } from "@/lib/hydrate-once";

import { fetchSubscribers } from "./newsletter-api";
import { persistServerSubscribers } from "./newsletter-repository";

/**
 * Hydrates the newsletter subscriber list from the server once on entering the
 * admin, so the admin sees every subscriber (including storefront sign-ups from
 * other devices). The server is the source of truth; every change dual-writes.
 *
 * Safe to mount TWICE, which is what lets the screen that displays this cache
 * ask for it immediately instead of waiting out the admin layout's
 * `useIdle(1000)` deferral. `hydrateOnce` makes the layout's later call join
 * this read rather than issue another.
 */
export function useNewsletterServerSync(): void {
  useEffect(() => {
    void hydrateOnce("newsletter", async () => {
      const subscribers = await fetchSubscribers();
      if (subscribers) persistServerSubscribers(subscribers);
    });
  }, []);
}
