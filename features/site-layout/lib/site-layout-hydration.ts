"use client";

import { fetchSeoStore, seoHydration } from "./site-layout-api";
import { persistServerSeo } from "@/features/seo/lib/seo-repository";

/**
 * On-demand opener for the SEO gate.
 *
 * `useSeoServerSync` opens it from a `[]`-dep effect, and that is not enough on
 * its own. An admin who signs in through the LOGIN FORM loads the admin layout
 * while anonymous, so that read 401s and the gate stays shut — and reaching the
 * admin afterwards is a `router.push`, a soft navigation that never remounts
 * the layout. The effect never runs again, so without an opener the gate stays
 * shut for the whole session and every save reports "saved on this device
 * only". The settings and invoice-settings gates were each given one for
 * exactly this.
 *
 * Being callable also lets a FORM adopt the server's values before it unlocks,
 * rather than racing whoever else might be fetching.
 *
 * The site-layout gate's opener lives with its sync component instead: header,
 * footer and appearance are covered by one gate, and the appearance repository
 * is under `apps/`, which a domain module here may not import.
 */
export async function ensureSeoHydrated(): Promise<boolean> {
  if (seoHydration.hasSettled()) return true;

  const store = await fetchSeoStore();
  // A null is a failed or forbidden read, not an empty store — the SEO store is
  // written back WHOLE, so settling on it would let this browser's demo
  // canonical domain and demo titles replace the shop's.
  if (!store) return false;

  persistServerSeo(store);
  seoHydration.markSettled();
  return true;
}
