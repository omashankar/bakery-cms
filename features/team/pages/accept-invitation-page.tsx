"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { acceptInvitation, lookupInvitation } from "@/features/team/lib/team-api";
import type { InvitationPreview } from "@/features/team/lib/team-types";

/** Why a link did not open — each gets its own heading and next step. */
type LinkProblem = "missing" | "expired" | "used" | "invalid" | "unreachable";

function problemFor(status: number): LinkProblem {
  if (status === 410) return "expired";
  if (status === 409) return "used";
  if (status === 0 || status >= 500 || status === 429) return "unreachable";
  return "invalid";
}

type Stage =
  | { kind: "checking" }
  | { kind: "invalid"; reason: LinkProblem; message: string }
  | { kind: "form"; token: string; invitation: InvitationPreview }
  | { kind: "done"; email: string };

interface JoinForm {
  name: string;
  password: string;
  confirmPassword: string;
}

/**
 * Reads the token from the link's FRAGMENT (`/invite#token=…`).
 *
 * A fragment never leaves the browser — not in a request line, a server log or a
 * Referer header — and it is taken out of the address bar as soon as it is read,
 * so it does not sit in the history either. The token then travels only in the
 * body of the two POSTs below.
 */
function takeTokenFromUrl(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const token = new URLSearchParams(hash).get("token");
  if (token) window.history.replaceState(null, "", window.location.pathname);
  return token;
}

export function AcceptInvitationPage() {
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, watch, reset, formState } = useForm<JoinForm>();

  /**
   * Read ONCE and kept. The URL is cleared the moment the token is taken, so a
   * second run of this effect — React runs it twice in development, and a
   * remount does the same — found no token and told a valid invitee their
   * link was broken.
   */
  const tokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = takeTokenFromUrl();
    const token = tokenRef.current;
    if (!token) {
      setStage({
        kind: "invalid",
        reason: "missing",
        message: "This page needs the link from your invitation email. Open the email and use the button in it.",
      });
      return;
    }
    let cancelled = false;
    void lookupInvitation(token).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setStage({ kind: "form", token, invitation: result.data });
        reset({ name: result.data.name, password: "", confirmPassword: "" });
      } else {
        setStage({ kind: "invalid", reason: problemFor(result.status), message: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reset]);

  async function onSubmit(data: JoinForm) {
    if (stage.kind !== "form") return;
    setSubmitError(null);
    const result = await acceptInvitation({ token: stage.token, ...data });
    if (result.ok && result.data) {
      setStage({ kind: "done", email: result.data.email });
    } else {
      setSubmitError(result.message);
    }
  }

  if (stage.kind === "checking") {
    return (
      <AuthCard title="Checking your invitation" description="One moment…">
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      </AuthCard>
    );
  }

  if (stage.kind === "invalid") {
    const copy: Record<LinkProblem, { title: string; help: string }> = {
      missing: {
        title: "Open the link from your email",
        help: "This page only works from the button in your invitation email. Open that email and tap the button.",
      },
      expired: {
        title: "This invitation has expired",
        help: "Invitation links last 7 days. Ask the shop owner to send you a new one — they can resend it from Settings → Team & permissions.",
      },
      used: {
        title: "You've already joined",
        help: "This invitation was used to create your account. Sign in with your email and the password you chose.",
      },
      invalid: {
        title: "This invitation link doesn't work",
        help: "It may have been cancelled, or a newer link was sent. Ask the shop owner to send you a fresh invitation.",
      },
      unreachable: {
        title: "We couldn't check your invitation",
        help: "Check your internet connection and open the link again in a minute.",
      },
    };
    const { title, help } = copy[stage.reason];
    return (
      <AuthCard title={title} description={help}>
        <div className="space-y-4">
          <Button
            className="w-full"
            variant={stage.reason === "used" ? "default" : "outline"}
            render={<Link href={routes.auth.login} />}
            nativeButton={false}
          >
            {stage.reason === "used" ? "Sign in" : "Go to sign in"}
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (stage.kind === "done") {
    return (
      <AuthCard title="You're on the team" description="Your account is ready.">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Sign in with <span className="font-medium text-foreground">{stage.email}</span> and the password you just set.
          </p>
          <Button className="w-full" render={<Link href={routes.auth.login} />} nativeButton={false}>
            Sign in
          </Button>
        </div>
      </AuthCard>
    );
  }

  const { invitation } = stage;
  return (
    <AuthCard
      title="Join the team"
      description={`You've been invited as ${invitation.roleName}. Set a password to finish.`}
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" value={invitation.email} readOnly autoComplete="username" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-name">Your name</Label>
          <Input
            id="invite-name"
            autoComplete="name"
            {...register("name", { required: "Enter your name", maxLength: { value: 120, message: "That name is too long" } })}
          />
          {formState.errors.name ? <p className="text-xs text-destructive">{formState.errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-password">Password</Label>
          <div className="relative">
            <Input
              id="invite-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters, letters and numbers"
              {...register("password", {
                required: "Choose a password",
                minLength: { value: 8, message: "Minimum 8 characters" },
                validate: (value) =>
                  (/[a-zA-Z]/.test(value) && /[0-9]/.test(value)) || "Include letters and numbers",
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors.password ? (
            <p className="text-xs text-destructive">{formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-confirm">Confirm password</Label>
          <Input
            id="invite-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("confirmPassword", {
              required: "Type the password again",
              validate: (value) => value === watch("password") || "Passwords do not match",
            })}
          />
          {formState.errors.confirmPassword ? (
            <p className="text-xs text-destructive">{formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {submitError ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {formState.isSubmitting ? "Creating your account…" : "Create my account"}
        </Button>
      </form>
    </AuthCard>
  );
}
