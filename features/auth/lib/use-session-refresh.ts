"use client";

import { useEffect } from "react";

import { refreshSession } from "./auth-api";

// Access tokens live ~15 min; refresh well inside that window so an open admin
// tab never hits an expired token. The refresh token is good for ~30 days.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_GAP_MS = 60 * 1000; // coalesce focus/visibility bursts

/**
 * How long without a human before the timer stops holding the session open.
 *
 * The interval fired unconditionally, so an admin tab left open on a shared
 * terminal renewed itself every ten minutes off a thirty-day refresh cookie —
 * for a month, with nobody there. That made the shop's session timeout
 * unreachable by construction: the server's idle check can only fire if the
 * client stops asking.
 *
 * Generous on purpose. This is not the timeout — the server decides that. It
 * only stops the browser from lying about someone being present.
 */
const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Keeps the admin session alive by silently rotating the access token:
 *  - once on mount (renews a token that expired while the tab was closed/idle),
 *  - every 10 minutes, and
 *  - when the tab regains focus / becomes visible (covers long idle).
 *
 * Without this the access token simply expires and every admin API call starts
 * returning 401. Best-effort — a failed refresh (revoked, expired, or a session
 * the server has timed out) just means the user signs in again.
 *
 * The interval renews only when somebody has been present recently. It used to
 * fire regardless, which kept an unattended tab signed in for the life of the
 * thirty-day refresh cookie and made the shop's own session timeout
 * unreachable.
 */
export function useSessionRefresh(): void {
  useEffect(() => {
    let last = 0;
    let lastSeen = Date.now();

    const markPresent = () => {
      lastSeen = Date.now();
    };

    const tick = (requirePresence: boolean) => {
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      // The TIMER has to show a human was here; a focus event or a mount is
      // itself the evidence, so those pass straight through.
      if (requirePresence && now - lastSeen > PRESENCE_WINDOW_MS) return;
      last = now;
      void refreshSession();
    };

    tick(false); // renew immediately in case the access token already expired
    const interval = window.setInterval(() => tick(true), REFRESH_INTERVAL_MS);

    const onFocus = () => {
      markPresent();
      tick(false);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      markPresent();
      tick(false);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Anything a person does counts, and none of it triggers a request —
    // these only record that somebody is still there.
    const PRESENCE_EVENTS = ["pointerdown", "keydown", "scroll"] as const;
    for (const event of PRESENCE_EVENTS) {
      window.addEventListener(event, markPresent, { passive: true });
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const event of PRESENCE_EVENTS) {
        window.removeEventListener(event, markPresent);
      }
    };
  }, []);
}
