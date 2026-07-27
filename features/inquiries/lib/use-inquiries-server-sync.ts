"use client";

import { useEffect } from "react";

import { fetchInquiries } from "./inquiries-api";
import { persistServerInquiries } from "./inquiries-repository";

/**
 * Hydrates the local inquiry cache from the server once on entering the admin,
 * so the admin sees every inquiry (including contact-form submissions from other
 * devices). The server is the source of truth; every create/change dual-writes.
 */
export function useInquiriesServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const inquiries = await fetchInquiries();
      if (!cancelled && inquiries) persistServerInquiries(inquiries);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
