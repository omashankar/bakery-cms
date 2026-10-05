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
import { persistServerAppearance } from "@/features/site-layout/lib/appearance-repository";
import { shareHydration } from "@/lib/hydrate-once";

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
export function ensureSiteLayoutHydrated(): Promise<boolean> {
  if (siteLayoutHydration.hasSettled()) return Promise.resolve(true);

  /*
    ONE BATCH PER BROWSER, HOWEVER MANY CALLERS ASK AT ONCE.

    The line above answers for a read that has FINISHED, and says nothing about
    one in flight. On /admin/header the page's own form effect asks at mount and
    the layout's deferred hydration asks a beat later, before the first has
    settled — so both issued header, footer and appearance. Six requests for
    three documents, measured.

    The cost is not the three extra requests. The loser's response landed about
    eight seconds after it was issued, carrying a snapshot taken before that,
    and wrote it into the cache with `persistServerHeader`. A save made inside
    that window is silently reverted in this browser, and a remount then adopts
    the reverted copy as BOTH the working and the saved one — the failure
    `header-repository.ts` documents for a refused WRITE, arriving through a
    duplicate READ. Today the screen is too slow for anyone to reach that
    window. That is not a guard.
  */
  return shareHydration("site-layout", readSiteLayout);
}

async function readSiteLayout(): Promise<boolean> {
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
