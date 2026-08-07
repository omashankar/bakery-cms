"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthDemoNotice } from "@/features/auth/components/auth-demo-notice";
import { clearResetFlow, getResetFlow } from "@/features/auth/lib/reset-flow";
import { resetPasswordRequest } from "@/features/auth/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";

type ResetPasswordForm = {
  password: string;
  confirmPassword: string;
};

export function ResetPasswordFormPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const { register, handleSubmit, watch, formState } = useForm<ResetPasswordForm>();

  // Only reachable once the OTP step passed — otherwise restart the flow.
  useEffect(() => {
    const flow = getResetFlow();
    if (!flow?.verified) {
      router.replace(routes.auth.forgotPassword);
      return;
    }
    setAllowed(true);
  }, [router]);

  const onSubmit = async (data: ResetPasswordForm) => {
    const flow = getResetFlow();
    if (!flow?.email || !flow.otp) {
      router.replace(routes.auth.forgotPassword);
      return;
    }
    try {
      await resetPasswordRequest({
        email: flow.email,
        otp: flow.otp,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      clearResetFlow();
      toast.success("Password updated");
      router.push(routes.auth.success);
    } catch (error) {
      toast.error("Could not update password", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (!allowed) return null;

  return (
    <AuthCard
      title="Create new password"
      // The rule the SERVER applies. This said "letters and numbers" while
      // `strongPassword` also requires an uppercase letter, so a password
      // typed to match this sentence was refused — on the one screen a user
      // reaches when they are already locked out.
      description="At least 8 characters, with letters and numbers."
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
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter new password"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Minimum 8 characters" },
                // Checked here too, so the answer arrives before a round
                // trip rather than as a refusal from the server.
                validate: (value: string) =>
                  (/[a-zA-Z]/.test(value) && /[0-9]/.test(value)) ||
                  "Include letters and numbers",
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
            <p className="text-xs text-destructive">
              {formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm new password"
              {...register("confirmPassword", {
                required: "Please confirm your password",
                validate: (value) =>
                  value === watch("password") || "Passwords do not match",
              })}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors.confirmPassword ? (
            <p className="text-xs text-destructive">
              {formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {formState.isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>

      <AuthDemoNotice />
    </AuthCard>
  );
}
