"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthDemoNotice } from "@/features/auth/components/auth-demo-notice";
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
  const { register, handleSubmit, formState } = useForm<ForgotPasswordForm>({
    defaultValues: { email: "admin@bakery.com" },
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSent(true);
    toast.success("Reset link sent", {
      description: `Instructions sent to ${data.email}`,
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
            placeholder="admin@bakery.com"
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
