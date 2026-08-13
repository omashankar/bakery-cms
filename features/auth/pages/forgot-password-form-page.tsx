"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthDemoNotice } from "@/features/auth/components/auth-demo-notice";
import { startResetFlow } from "@/features/auth/lib/reset-flow";
import { AuthRequestError, forgotPasswordRequest, isDeliveryFailure } from "@/features/auth/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";

type ForgotPasswordForm = {
  email: string;
};

export function ForgotPasswordFormPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  /**
   * Not prefilled, and not with a real person's address.
   *
   * This page is public and shipped with a real inbox typed into it, so any
   * visitor could land here and press Send — a password-reset code to somebody
   * else's mailbox, with nothing typed. The login page carried the same
   * address as a default (see there); this is the one where a single click
   * sends mail.
   */
  const { register, handleSubmit, formState } = useForm<ForgotPasswordForm>({
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      await forgotPasswordRequest(data.email);
    } catch (error) {
      /**
       * Keep the existence-hiding, drop the rest.
       *
       * The endpoint never reveals whether the email is registered, and the
       * flow must stay identical for every input — that part is deliberate.
       * But this caught EVERY error, so a rate-limited or failed request still
       * showed "Reset code sent", turned the panel green and pushed the
       * customer to an OTP screen backed by no reset row. They then sat typing
       * codes from an email that was never sent.
       */
      if (isDeliveryFailure(error)) {
        /**
         * A throttle is not a connection problem.
         *
         * `isDeliveryFailure` counts a 429 as "not sent", which is right — but
         * the message told the customer to check their connection, a remedy
         * that cannot work, and threw away the server's own sentence, which is
         * the one that says how long to wait.
         */
        const throttled = error instanceof AuthRequestError && error.status === 429;
        toast.error(throttled ? "Too many attempts" : "Could not send the reset code", {
          description: throttled
            ? error.message
            : "The server did not answer. Check your connection and try again.",
        });
        return;
      }
    }
    startResetFlow(data.email);
    setSent(true);
    toast.success("Reset code sent", {
      description: `If ${data.email} is registered, a code is on its way.`,
    });
    setTimeout(() => router.push(routes.auth.otp), 1200);
  };

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your admin email and we'll send a verification code."
      footer={
        <Link
          href={routes.auth.login}
          className="block text-center text-xs text-muted-foreground hover:text-bakery-700"
        >
          ← Back to login
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={sent}
            {...register("email", { required: "Email is required" })}
          />
          {formState.errors.email ? (
            <p className="text-xs text-destructive">{formState.errors.email.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={formState.isSubmitting || sent}
        >
          {formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {formState.isSubmitting ? "Sending…" : "Send verification code"}
        </Button>
      </form>

      {sent ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          <p className="flex items-center gap-1.5 font-medium">
            <MailCheck className="size-3.5" />
            Verification code sent. Redirecting…
          </p>
        </div>
      ) : null}

      <AuthDemoNotice />
    </AuthCard>
  );
}
