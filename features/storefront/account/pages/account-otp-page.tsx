"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { OtpInput } from "@/features/auth/components/otp-input";
import { AccountAuthCard } from "@/features/storefront/account/components/account-auth-card";
import { AccountDemoNotice } from "@/features/storefront/account/components/account-demo-notice";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function AccountOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("Enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);
    toast.success("Code verified");
    router.push(routes.account.resetPassword);
  }

  return (
    <>
      <StorePageHeader
        title="Verify Email"
        description="Enter the 6-digit code we sent to your email."
        breadcrumbs={[
          { label: "Login", href: routes.account.login },
          { label: "Verify" },
        ]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="Enter verification code"
            description="Check your inbox for the 6-digit code."
            footer={
              <Link
                href={routes.account.login}
                className="block text-center text-sm text-muted-foreground hover:text-bakery-700"
              >
                ← Back to login
              </Link>
            }
          >
            <form className="space-y-4" onSubmit={handleSubmit}>
              <OtpInput value={otp} onChange={setOtp} />
              {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}

              <Button type="submit" variant="bakery" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {loading ? "Verifying…" : "Verify code"}
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-bakery-700"
                onClick={() => toast.message("Code resent (demo)")}
              >
                Resend code
              </button>
              <span className="text-muted-foreground">Demo: any 6 digits</span>
            </div>

            <AccountDemoNotice />
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
