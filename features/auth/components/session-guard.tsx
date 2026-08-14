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
import { loginRequest, refreshSession } from "../lib/auth-api";
import {
  markSessionActive,
  markSessionExpired,
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

/** How long the warning counts down before asking the server for the verdict. */
const COUNTDOWN_SECONDS = 60;

function ExpiringSoon() {
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);
  const [checking, setChecking] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    // Counted from a start TIMESTAMP rather than by decrementing: a background
    // tab throttles its timers, and a decrementing counter would come back
    // reading forty seconds left on a session that ended thirty seconds ago.
    const started = Date.now();

    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        COUNTDOWN_SECONDS - Math.round((Date.now() - started) / 1000),
      );
      setLeft(remaining);
      if (remaining > 0 || asked.current) return;

      /**
       * At zero, ASK rather than announce.
       *
       * This countdown is a prediction from the shop's timeout and the last
       * sign of a human; the server holds the real clock and its answer can
       * differ. Declaring the session over here would be this screen making a
       * claim it has not checked — the mistake the rest of this admin was
       * built to stop making.
       */
      asked.current = true;
      setChecking(true);
      void refreshSession().then((outcome) => {
        if (outcome === "expired") markSessionExpired();
        else if (outcome === "renewed") markSessionActive();
        else {
          // Server unreachable: nothing is known, so nothing is claimed. Let
          // them try again rather than sitting on a dead countdown.
          asked.current = false;
          setChecking(false);
        }
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const stay = async () => {
    setChecking(true);
    const outcome = await refreshSession();
    if (outcome === "renewed") {
      markSessionActive();
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
              : `This shop signs admins out after a period of inactivity. Yours ends in ${left} second${left === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={stay} disabled={checking}>
            {checking ? "Checking…" : "Stay signed in"}
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
      markSessionActive();
      // The server components on this page rendered against the old session;
      // re-run them so the data behind this dialog is real again.
      router.refresh();
      toast.success("Signed back in");
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
