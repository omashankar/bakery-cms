"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthDemoNotice } from "@/features/auth/components/auth-demo-notice";
import { OtpInput } from "@/features/auth/components/otp-input";
import { getResetFlow, markResetVerified } from "@/features/auth/lib/reset-flow";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export function OtpFormPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  // Reached without asking for a code? Send them back to step one.
  useEffect(() => {
    const flow = getResetFlow();
    if (!flow) {
      router.replace(routes.auth.forgotPassword);
      return;
    }
    setEmail(flow.email);
  }, [router]);

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
    markResetVerified();
    toast.success("Code verified");
    router.push(routes.auth.resetPassword);
  }

  if (!email) return null;

  return (
    <AuthCard
      title="Verify your email"
      description={`Enter the 6-digit code sent to ${email}.`}
      footer={
        <Link
          href={routes.auth.login}
          className="block text-center text-xs text-muted-foreground hover:text-bakery-700"
        >
          ← Back to login
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <OtpInput value={otp} onChange={setOtp} />
        {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
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
        <span className="text-muted-foreground">Demo code: any 6 digits</span>
      </div>

      <AuthDemoNotice />
    </AuthCard>
  );
}
