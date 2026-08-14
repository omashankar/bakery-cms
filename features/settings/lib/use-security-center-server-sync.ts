"use client";

import { useEffect } from "react";

import { fetchSecurityCenter, securityCenterHydration } from "./security-center-api";
import { persistServerSecurityCenter } from "./security-center-repository";

/**
 * Hydrates the Security Center from the server once on entering the admin. The
 * state is DERIVED server-side from the real login audit trail + live device
 * sessions, so it is accurate and consistent across devices (unlike the old
 * client-generated mock). Revoke / log-out-everywhere perform real revocation.
 */
export function useSecurityCenterServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const state = await fetchSecurityCenter();
      if (cancelled) return;
      if (state) persistServerSecurityCenter(state);
      // Settled either way — a refused read is still an answer, and a header
      // stuck on a dash forever says less than the count it could show.
      securityCenterHydration.markSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
