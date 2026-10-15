"use client";

import { useEffect } from "react";
import { hydrateOnce, markHydrated } from "@/lib/hydrate-once";
import type { Inquiry } from "@/types/inquiry";

import { fetchInquiries } from "./inquiries-api";
import { persistServerInquiries } from "./inquiries-repository";

/**
 * Hydrates the local inquiry cache from the server once on entering the admin,
 * so the admin sees every inquiry (including contact-form submissions from other
 * devices). The server is the source of truth; every create/change dual-writes.
 *
 * Safe to mount TWICE, which is what lets the screen that displays this cache
 * ask for it immediately instead of waiting out the admin layout's
 * `useIdle(1000)` deferral. `hydrateOnce` makes the layout's later call join
 * this read rather than issue another.
 */
/**
 * The enquiries the SERVER read for this page, applied without a request. The
 * sidebar's "new" badge, the bell and the Inquiries screens all read this
 * cache, and every admin page fetched it behind the shell.
 */
export function applyServerInquiries(inquiries: Inquiry[]): void {
  persistServerInquiries(inquiries);
  markHydrated("inquiries");
}

export function useInquiriesServerSync(): void {
  useEffect(() => {
    void hydrateOnce("inquiries", async () => {
      const inquiries = await fetchInquiries();
      if (inquiries) persistServerInquiries(inquiries);
    });
  }, []);
}
