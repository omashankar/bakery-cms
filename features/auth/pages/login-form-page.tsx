"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthDemoNotice } from "@/features/auth/components/auth-demo-notice";
import { setDemoSession } from "@/features/auth/lib/session";
import {
  recordFailedLogin,
  recordLoginSuccess,
} from "@/features/admin/settings/lib/security-center-repository";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

type LoginForm = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const fieldClass =
  "h-12 rounded-xl border-border bg-cream-50 px-4 text-[15px] shadow-none transition-colors placeholder:text-muted-foreground/65 focus-visible:border-bakery-700 focus-visible:bg-card focus-visible:ring-bakery-700/15";

export function LoginFormPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { register, control, handleSubmit, formState } = useForm<LoginForm>({
    defaultValues: {
      email: "admin@bakery.com",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (data: LoginForm) => {
    await new Promise((resolve) => setTimeout(resolve, 900));

    if (data.password === "invalid") {
      recordFailedLogin(data.email, "Invalid password");
      toast.error("Sign in failed", {
        description: "Invalid password. For this demo, use any password except “invalid”.",
      });
      return;
    }

    setDemoSession(data.email, data.rememberMe);
    recordLoginSuccess(data.email);
    toast.success("Signed in", {
      description: "Opening your dashboard…",
    });
    router.push(routes.admin.dashboard);
  };

  return (
    <AuthCard
      title="Sign in"
      description="Enter your staff credentials to open the bakery dashboard."
      footer={
        <div className="flex flex-col items-center gap-3 text-center">
          <AuthDemoNotice />
          <Link
            href={routes.store.home}
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← Back to website
          </Link>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[13px] font-semibold text-foreground">
            Email
          </Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@bakery.com"
              className={cn(fieldClass, "pl-11")}
              aria-invalid={!!formState.errors.email}
              aria-describedby={formState.errors.email ? "email-error" : undefined}
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address",
                },
              })}
            />
          </div>
          {formState.errors.email ? (
            <p id="email-error" className="text-xs text-destructive">
              {formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[13px] font-semibold text-foreground">
            Password
          </Label>
          <div className="relative">
            <Lock
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={cn(fieldClass, "pl-11 pr-12")}
              aria-invalid={!!formState.errors.password}
              aria-describedby={
                formState.errors.password ? "password-error" : undefined
              }
              {...register("password", {
                required: "Password is required",
                minLength: { value: 6, message: "Minimum 6 characters" },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors.password ? (
            <p id="password-error" className="text-xs text-destructive">
              {formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Controller
              name="rememberMe"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="rememberMe"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground">
              Keep me signed in
            </Label>
          </div>
          <Link
            href={routes.auth.forgotPassword}
            className="text-[13px] font-medium text-bakery-700 underline-offset-4 transition-colors hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="bakery"
          className="h-12 w-full rounded-xl text-[15px] font-semibold"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {formState.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
