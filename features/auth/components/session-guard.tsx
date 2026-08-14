"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { routes } from "@/constants/routes";
import { getSecuritySettings } from "@/features/settings/lib/settings-repository";
import { recordLoginSuccess } from "@/features/settings/lib/security-center-repository";
import { loginRequest, refreshSession } from "../lib/auth-api";
import {
  idleForMs,
  markSessionExpired,
  markSessionRenewed,
  sessionState,
  subscribeToSession,
  type SessionState,
} from "../lib/session-expiry";
import { setDemoSession } from "../lib/session";

/**
 * What an admin sees when their session runs out under them.
 *
 * Before this there was nothing. The server ended the session and answered
 * 401; the panel stayed on screen and emptied out, because every `*-api.ts`
 * maps a non-ok response to "no data" — so the lists showed their empty states
 * and each save reported "saved on this device only". The person found out by
 * losing work.
 *
 * They stay on the page they were on. A redirect to /login would be simpler and
 * would throw away whatever is half-typed in the form behind this dialog, which
 * is exactly the moment an idle timeout tends to arrive.
 */
export function SessionGuard() {
  /**
   * Subscribed AND read in the same step.
   *
   * Reading once in an effect leaves a gap: a 401 landing between the first
   * render and the subscription would be missed, and a missed transition is an
   * admin sitting on a dead panel with nothing on screen — the bug this exists
   * to fix. The server snapshot is "active" because a session cannot have
   * expired before the page it renders has been sent.
   */
  const state = useSyncExternalStore<SessionState>(
    subscribeToSession,
    sessionState,
    () => "active",
  );

  if (state === "expiring") return <ExpiringSoon />;
  if (state === "expired") return <SignInAgain />;
  return null;
}

/** Seconds until the server would consider this session idle past its timeout. */
function secondsLeft(): number {
  const minutes = Number(getSecuritySettings().sessionTimeoutMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(0, Math.round((minutes * 60 * 1000 - idleForMs()) / 1000));
}

function ExpiringSoon() {
  const [left, setLeft] = useState(secondsLeft);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Recomputed from the clock rather than decremented: a background tab
    // throttles its timers, and a counter that ticks down would come back
    // reading forty seconds left on a session that ended thirty seconds ago.
    const timer = window.setInterval(() => setLeft(secondsLeft()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * At zero this does NOTHING, on purpose.
   *
   * The first version "asked the server for the verdict" here — but
   * /api/auth/refresh is a RENEWAL, not a read, so asking was extending. On an
   * unattended tab the answer came back "renewed", the warning cleared, the
   * watcher re-fired seconds later, and the whole thing repeated about every
   * seventy seconds for as long as the tab stayed open: the shop's idle
   * timeout became unreachable and the session was held open by the very
   * dialog warning that it was about to close — roughly twelve hundred
   * rotations a day with nobody in the room. That is precisely the regression
   * `PRESENCE_WINDOW_MS` was introduced to end.
   *
   * So the countdown only ever COUNTS. Renewing is a human pressing the button
   * below, which is itself the evidence of presence the server's timeout is
   * asking for. If nobody presses it, the session lapses exactly as the shop
   * configured, and the next request's 401 raises the sign-in dialog.
   */

  const stay = async () => {
    setChecking(true);
    const outcome = await refreshSession();
    if (outcome === "renewed") {
      markSessionRenewed();
      return;
    }
    if (outcome === "expired") {
      markSessionExpired();
      return;
    }
    setChecking(false);
    toast.error("Could not reach the server", {
      description: "Your session is unchanged. Check your connection.",
    });
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            {checking
              ? "Checking with the server…"
              : left > 0
                ? `This shop signs admins out after a period of inactivity. Yours ends in ${left} second${left === 1 ? "" : "s"}.`
                : // Past the deadline the button still works: the server may not
                  // have been asked yet, and if it has ended, pressing it says
                  // so plainly instead of this dialog guessing.
                  "Your session may already have ended. Press below to find out."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={stay} disabled={checking}>
            {checking ? "Checking…" : left > 0 ? "Stay signed in" : "Check now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignInAgain() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // `rememberMe: false` — this is re-entry on a machine that has just been
      // left unattended long enough to time out, so it must not quietly upgrade
      // the session to one that survives closing the browser.
      const user = await loginRequest({ email, password, rememberMe: false });
      setDemoSession(user.email, false);
      // The same bookkeeping the login PAGE does. Without it the Security
      // Center's login history and device list quietly omit every re-entry
      // made through this dialog — a sign-in that does not appear in the log
      // of sign-ins is worse than no log.
      recordLoginSuccess(user.email);
      markSessionRenewed();
      router.refresh();
      /**
       * Says what actually happened.
       *
       * `router.refresh()` re-runs Server Components and deliberately PRESERVES
       * client state — and every admin screen here is a client component that
       * fetches in an effect on mount. So the lists that emptied while the
       * session was dead do not come back on their own, and claiming "the data
       * behind this dialog is real again" would be this screen reporting
       * something that did not happen. The unsaved edits are the reason we did
       * not simply reload, so the choice belongs to the person holding them.
       */
      toast.success("Signed back in", {
        description: "Save your work, then reload to refresh this page's data.",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Your session has ended</DialogTitle>
          <DialogDescription>
            Sign in to carry on where you were. Nothing on this page has been
            lost — but it has not been saved either.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-email">Email</Label>
            <Input
              id="session-email"
              ref={emailRef}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-password">Password</Label>
            <Input
              id="session-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            {/*
              A way out that does not depend on this dialog working — a
              different account, a forgotten password, or anything this form
              cannot express. It leaves the page, which is why it is the second
              option rather than the first.
            */}
            <Link
              href={routes.auth.login}
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Sign in on the login page instead
            </Link>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
