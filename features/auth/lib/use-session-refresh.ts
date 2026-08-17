"use client";

import { useEffect } from "react";

import { refreshSession } from "./auth-api";
import {
  idleForMs,
  markQuestionUnanswered,
  markSessionExpired,
  markSessionExpiring,
  markSessionRenewed,
  sessionState,
  setExpiryConfirmer,
} from "./session-expiry";
import { getSecuritySettings } from "@/features/settings/lib/settings-repository";

/**
 * How often an ACTIVE admin touches the server, derived from the shop's own
 * session timeout rather than fixed at ten minutes.
 *
 * A fixed ten minutes is longer than the timeout an owner is allowed to choose.
 * The Security screen offers a minimum of 5, and the server's idle check runs
 * against `lastSeenAt` — which only moves when the client asks. So an owner who
 * set 5, or 10, signed themselves out while actively working: they typed, the
 * timer had not fired, the server saw an idle session and ended it, and the
 * admin panel started 401-ing until they signed in again. Tightening the
 * shop's security setting made the admin unusable, which is the worst way for
 * a security control to fail.
 *
 * A third of the timeout gives two chances to be seen before it expires.
 * Floored at a minute so a five-minute policy cannot turn into a request storm,
 * and capped at the old ten so nothing gets chattier than it was.
 */
const REFRESH_FLOOR_MS = 60 * 1000;
const REFRESH_CEILING_MS = 10 * 60 * 1000;

function refreshIntervalMs(): number {
  const minutes = Number(getSecuritySettings().sessionTimeoutMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return REFRESH_CEILING_MS;
  return Math.min(REFRESH_CEILING_MS, Math.max(REFRESH_FLOOR_MS, (minutes * 60 * 1000) / 3));
}

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
 * How much notice someone gets before the idle timeout takes their session.
 *
 * Long enough to finish a sentence and click, short enough that it is not
 * nagging an admin who simply paused to read something. The countdown is a
 * PREDICTION from the shop's own timeout and the last sign of a human — the
 * server decides the real moment, and that decision still arrives as a 401.
 */
const WARN_BEFORE_MS = 60 * 1000;

/** How often to compare "how long since a human" against the shop's timeout. */
const WATCH_TICK_MS = 10 * 1000;

function sessionTimeoutMs(): number {
  const minutes = Number(getSecuritySettings().sessionTimeoutMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return minutes * 60 * 1000;
}

/**
 * Keeps the admin session alive by silently rotating the access token:
 *  - once on mount (renews a token that expired while the tab was closed/idle),
 *  - on a timer derived from the shop's session timeout, and
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

    /**
     * Somebody is here. That is ALL this records.
     *
     * It used to clear the warning too, and that broke the warning's only
     * button: the listener is on `window`, so the pointerdown that presses
     * "Stay signed in" reached this first, the dialog unmounted, and the click
     * never arrived at its handler. The warning was dismissed, the server's
     * clock was never touched, and the session went on to expire anyway — with
     * the admin believing they had kept it.
     *
     * Only a successful RENEWAL clears the warning now, because only a renewal
     * changes the fact the warning is about.
     */
    const markPresent = () => {
      lastSeen = Date.now();
    };

    const renew = () =>
      refreshSession().then((outcome) => {
        // `unreachable` is deliberately not an expiry: the server never
        // answered, so nothing is known, and signing an admin out mid-edit for
        // a dropped request would be the wrong cure.
        if (outcome === "expired") markSessionExpired();
        else if (outcome === "renewed") markSessionRenewed();
        // Nothing was learned — but say so, or the store goes on believing a
        // question is in flight and refuses to let anything ask again.
        else markQuestionUnanswered();
        return outcome;
      });

    /**
     * Put the question a 401 raises to the server.
     *
     * A 401 usually means only that the short-lived access token has run out,
     * which is routine and repairable. This is the one place allowed to decide
     * it is more than that.
     */
    const forgetConfirmer = setExpiryConfirmer(() => {
      void renew();
    });

    const tick = (requirePresence: boolean) => {
      const now = Date.now();
      // Once the session is over, stop asking. The answer cannot change until
      // somebody signs in, and a heartbeat against a dead session is a request
      // every few minutes for as long as the tab stays open.
      if (sessionState() === "expired") return;
      if (now - last < MIN_GAP_MS) return;
      // The TIMER has to show a human was here; a focus event or a mount is
      // itself the evidence, so those pass straight through.
      if (requirePresence && now - lastSeen > PRESENCE_WINDOW_MS) return;
      last = now;
      void renew();
    };

    tick(false); // renew immediately in case the access token already expired

    // A self-rescheduling timeout rather than a fixed interval, so the delay is
    // recomputed each round: an admin who tightens the session timeout on the
    // Security screen has the heartbeat follow it in the same session, without
    // this hook needing to hear about the change.
    let timer = 0;
    const arm = () => {
      timer = window.setTimeout(() => {
        tick(true);
        arm();
      }, refreshIntervalMs());
    };
    arm();

    /**
     * Warn while there is still time to act.
     *
     * Measured against `idleForMs()` — the time since the last successful
     * REFRESH — because that is the instant the server's own `lastSeenAt`
     * moved, and the server's clock is the one that decides. Predicting from
     * the last keystroke instead put the two clocks minutes apart: the
     * heartbeat renews up to PRESENCE_WINDOW_MS after the last input, so the
     * warning fired on a session with minutes left, and the dialog then
     * "checked" by renewing it — warn, renew, warn, renew, about every seventy
     * seconds, on a tab with nobody in front of it.
     */
    let watch = 0;
    const armWatch = () => {
      watch = window.setTimeout(() => {
        const timeout = sessionTimeoutMs();
        // Read fresh each round, like the heartbeat's own delay: an owner who
        // changes the timeout on the Security screen has both follow it in the
        // same session, with neither needing to hear about the change.
        if (timeout > 0 && sessionState() !== "expired") {
          if (idleForMs() >= timeout - WARN_BEFORE_MS) markSessionExpiring();
        }
        armWatch();
      }, WATCH_TICK_MS);
    };
    armWatch();

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
      // Before the timers: a confirmer left registered outlives this layout and
      // would renew the admin session from a storefront page.
      forgetConfirmer();
      window.clearTimeout(timer);
      window.clearTimeout(watch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const event of PRESENCE_EVENTS) {
        window.removeEventListener(event, markPresent);
      }
    };
  }, []);
}
