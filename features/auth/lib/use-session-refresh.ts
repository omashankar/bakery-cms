"use client";

import { useEffect } from "react";

import { refreshSession } from "./auth-api";

// Access tokens live ~15 min; refresh well inside that window so an open admin
// tab never hits an expired token. The refresh token is good for ~30 days.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_GAP_MS = 60 * 1000; // coalesce focus/visibility bursts

/**
 * Keeps the admin session alive by silently rotating the access token:
 *  - once on mount (renews a token that expired while the tab was closed/idle),
 *  - every 10 minutes, and
 *  - when the tab regains focus / becomes visible (covers long idle).
 *
 * Without this the 15-minute access token simply expires and every admin API
 * call starts returning 401. Best-effort — a failed refresh (revoked/expired
 * refresh token) just means the user signs in again.
 */
export function useSessionRefresh(): void {
  useEffect(() => {
    let last = 0;

    const tick = () => {
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      void refreshSession();
    };

    tick(); // renew immediately in case the access token already expired
    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);

    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
