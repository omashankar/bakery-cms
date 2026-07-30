"use client";

import { useEffect } from "react";

import {
  siteLayoutHydration,
  fetchHeaderSettings,
  fetchFooterSettings,
  fetchAppearanceSettings,
} from "@/features/site-layout/lib/site-layout-api";
import { persistServerHeader } from "@/features/site-layout/lib/header-repository";
import { persistServerFooter } from "@/features/site-layout/lib/footer-repository";
import { persistServerAppearance } from "@/apps/admin/appearance/lib/appearance-repository";

/**
 * Hydrates header + footer settings from the server once on mount, so the
 * storefront and admin both read the durable server values. Reads are public.
 * After hydration the local cache matches the server, so admin mutations safely
 * dual-write replace-all.
 */
export function SiteLayoutServerSync() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [header, footer, appearance] = await Promise.all([
        fetchHeaderSettings(),
        fetchFooterSettings(),
        fetchAppearanceSettings(),
      ]);
      if (cancelled) return;
      if (header) persistServerHeader(header);
      if (footer) persistServerFooter(footer);
      if (appearance) persistServerAppearance(appearance);

      // Only NOW may a replace-all mutation send the local list — before this,
      // that list is whatever this browser happened to hold.
      if (header && footer && appearance) siteLayoutHydration.markSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
