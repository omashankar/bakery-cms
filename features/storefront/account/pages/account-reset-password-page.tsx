"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AccountAuthCard } from "@/features/storefront/account/components/account-auth-card";
import { AccountDemoNotice } from "@/features/storefront/account/components/account-demo-notice";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

type ResetPasswordForm = {
  password: string;
  confirmPassword: string;
};

export function AccountResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, handleSubmit, watch, formState } = useForm<ResetPasswordForm>();

  const onSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    toast.success("Password updated");
    router.push(routes.account.success);
  };

  return (
    <>
      <StorePageHeader
        title="Reset Password"
        description="Create a new password for your account."
        breadcrumbs={[
          { label: "Login", href: routes.account.login },
          { label: "Reset Password" },
        ]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="Create new password"
            description="Use at least 8 characters with letters and numbers."
            footer={
              <Link
                href={routes.account.login}
                className="block text-center text-sm text-muted-foreground hover:text-bakery-700"
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

              <Button
                type="submit"
                variant="bakery"
                className="w-full"
                disabled={formState.isSubmitting}
              >
                {formState.isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {formState.isSubmitting ? "Updating…" : "Update password"}
              </Button>
            </form>

            <AccountDemoNotice />
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
