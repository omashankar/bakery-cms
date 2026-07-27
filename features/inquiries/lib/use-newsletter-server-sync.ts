"use client";

import { useEffect } from "react";

import { fetchSubscribers } from "./newsletter-api";
import { persistServerSubscribers } from "./newsletter-repository";

/**
 * Hydrates the newsletter subscriber list from the server once on entering the
 * admin, so the admin sees every subscriber (including storefront sign-ups from
 * other devices). The server is the source of truth; every change dual-writes.
 */
export function useNewsletterServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const subscribers = await fetchSubscribers();
      if (!cancelled && subscribers) persistServerSubscribers(subscribers);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
