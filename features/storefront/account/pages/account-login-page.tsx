"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AccountAuthCard } from "@/features/storefront/account/components/account-auth-card";
import { AccountDemoNotice } from "@/features/storefront/account/components/account-demo-notice";
import { setCustomerSession, hasCustomerSession } from "@/features/storefront/account/lib/customer-session";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

type LoginForm = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export function AccountLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { register, control, handleSubmit, formState } = useForm<LoginForm>({
    defaultValues: {
      email: "customer@example.com",
      password: "",
      rememberMe: true,
    },
  });

  useEffect(() => {
    if (hasCustomerSession()) {
      router.replace(routes.account.dashboard);
    }
  }, [router]);

  const onSubmit = async (data: LoginForm) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const name = data.email.split("@")[0] ?? "Customer";
    setCustomerSession({ email: data.email, name }, data.rememberMe);
    toast.success("Welcome back!", {
      description: "Redirecting to your account…",
    });
    router.push(routes.account.dashboard);
  };

  return (
    <>
      <StorePageHeader
        title="Customer Login"
        description="Sign in to track orders, manage addresses, and checkout faster."
        breadcrumbs={[{ label: "Login" }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="Welcome back"
            description="Enter your email and password to access your account."
            footer={
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href={routes.account.register}
                  className="font-medium text-bakery-700 hover:underline"
                >
                  Create account
                </Link>
              </p>
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
                  aria-invalid={!!formState.errors.email}
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address",
                    },
                  })}
                />
                {formState.errors.email ? (
                  <p className="text-xs text-destructive">{formState.errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={!!formState.errors.password}
                    {...register("password", {
                      required: "Password is required",
                      minLength: { value: 6, message: "Minimum 6 characters" },
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                  <Label htmlFor="rememberMe" className="text-xs font-normal">
                    Remember me
                  </Label>
                </div>
                <Link
                  href={routes.account.forgotPassword}
                  className="text-xs font-medium text-bakery-700 hover:underline"
                >
                  Forgot password?
                </Link>
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
                {formState.isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <AccountDemoNotice />

            <p className="text-center text-xs text-muted-foreground">
              Admin user?{" "}
              <Link href={routes.auth.login} className="font-medium text-bakery-700 hover:underline">
                Go to admin login
              </Link>
            </p>
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
