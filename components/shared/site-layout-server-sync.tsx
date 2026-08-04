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
    void ensureSiteLayoutHydrated();
  }, []);

  return null;
}

/**
 * Reads the server's copy into the local one, and opens the gate if it worked.
 *
 * Callable rather than mount-only. This component renders in the root
 * providers, and an admin who signs in through the LOGIN FORM loads that tree
 * while anonymous — so if the reads fail the gate stays shut, and reaching the
 * admin afterwards is a soft navigation that never remounts it. Without an
 * opener the gate would stay shut for the whole session and every header,
 * footer or appearance save would report "saved on this device only". The
 * admin forms also call this so they can adopt the server's values BEFORE they
 * unlock, rather than racing whoever else might be fetching.
 *
 * It lives here rather than beside `ensureSeoHydrated` in
 * `features/site-layout/lib/` because it needs the appearance repository, which
 * is under `apps/` — and a domain module may not depend on an app's UI layer.
 */
export async function ensureSiteLayoutHydrated(): Promise<boolean> {
  if (siteLayoutHydration.hasSettled()) return true;

  const [header, footer, appearance] = await Promise.all([
    fetchHeaderSettings(),
    fetchFooterSettings(),
    fetchAppearanceSettings(),
  ]);

  if (header) persistServerHeader(header);
  if (footer) persistServerFooter(footer);
  if (appearance) persistServerAppearance(appearance);

  // Only NOW may a replace-all mutation send the local list — before this, that
  // list is whatever this browser happened to hold. ALL three, because one gate
  // vouches for all three stores: a partial read would open it for the blobs
  // that never arrived, and those are exactly the ones still holding the seed.
  if (!header || !footer || !appearance) return false;

  siteLayoutHydration.markSettled();
  return true;
}
