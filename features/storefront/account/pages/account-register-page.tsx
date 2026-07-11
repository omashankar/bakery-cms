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

type RegisterForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

export function AccountRegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, control, handleSubmit, watch, formState } = useForm<RegisterForm>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  useEffect(() => {
    if (hasCustomerSession()) {
      router.replace(routes.account.dashboard);
    }
  }, [router]);

  const onSubmit = async (data: RegisterForm) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setCustomerSession({
      email: data.email,
      name: data.name,
      phone: data.phone,
    });
    toast.success("Account created!", {
      description: "Welcome to our bakery family.",
    });
    router.push(routes.account.dashboard);
  };

  return (
    <>
      <StorePageHeader
        title="Create Account"
        description="Join us for faster checkout, order tracking, and exclusive offers."
        breadcrumbs={[{ label: "Register" }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="Create your account"
            description="Fill in your details to get started."
            footer={
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={routes.account.login}
                  className="font-medium text-bakery-700 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            }
          >
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Priya Sharma"
                  {...register("name", { required: "Name is required", minLength: 2 })}
                />
                {formState.errors.name ? (
                  <p className="text-xs text-destructive">{formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
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
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  {...register("phone", {
                    required: "Phone number is required",
                    minLength: { value: 10, message: "Enter a valid phone number" },
                  })}
                />
                {formState.errors.phone ? (
                  <p className="text-xs text-destructive">{formState.errors.phone.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
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
                    placeholder="Re-enter password"
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

              <div className="flex items-start gap-2">
                <Controller
                  name="acceptTerms"
                  control={control}
                  rules={{
                    validate: (value) => value === true || "You must accept the terms",
                  }}
                  render={({ field }) => (
                    <Checkbox
                      id="acceptTerms"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <Label htmlFor="acceptTerms" className="text-xs font-normal leading-relaxed">
                  I agree to the{" "}
                  <Link href={routes.store.terms} className="text-bakery-700 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href={routes.store.privacy} className="text-bakery-700 hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
              {formState.errors.acceptTerms ? (
                <p className="text-xs text-destructive">
                  {formState.errors.acceptTerms.message}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="bakery"
                className="w-full"
                disabled={formState.isSubmitting}
              >
                {formState.isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {formState.isSubmitting ? "Creating account…" : "Create account"}
              </Button>
            </form>

            <AccountDemoNotice />
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
