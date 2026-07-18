"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setCustomerSession } from "@/apps/website/account/lib/customer-session";
import { routes } from "@/constants/routes";

type Step = "phone" | "otp" | "signup";

const OTP_LENGTH = 5;
const RESEND_SECONDS = 20;

/** Fire from anywhere to open the single customer auth modal (lives in the navbar). */
export const OPEN_AUTH_MODAL_EVENT = "bakery-open-auth-modal";

export function openCustomerAuthModal(step: "phone" | "signup" = "phone") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_AUTH_MODAL_EVENT, { detail: { step } }));
}

interface CustomerAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which step to show when the modal opens. */
  initialStep?: "phone" | "signup";
  /** Called after a successful sign-in / sign-up. */
  onAuthenticated?: () => void;
}

export function CustomerAuthModal({
  open,
  onOpenChange,
  initialStep = "phone",
  onAuthenticated,
}: CustomerAuthModalProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [signup, setSignup] = useState({ firstName: "", lastName: "", dob: "", email: "" });
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Show the requested step on open; reset the flow after close so it reopens clean.
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      return;
    }
    const t = setTimeout(() => {
      setStep("phone");
      setOtp(Array(OTP_LENGTH).fill(""));
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [open, initialStep]);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const phoneValid = /^\d{10}$/.test(phone);
  const otpValue = otp.join("");
  const otpValid = otpValue.length === OTP_LENGTH;
  const displayPhone = phone.replace(/(\d{5})(\d{5})/, "$1 $2");

  function completeAuth(name: string, email: string) {
    setCustomerSession({ name, email, phone: `+91${phone}` }, true);
    onOpenChange(false);
    onAuthenticated?.();
    toast.success("Signed in", { description: "Welcome to Monginis!" });
  }

  async function handleSendOtp() {
    if (!phoneValid) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setStep("otp");
    setOtp(Array(OTP_LENGTH).fill(""));
    setResendIn(RESEND_SECONDS);
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleVerify() {
    if (!otpValid) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    completeAuth("Customer", `${phone}@customer.monginis`);
  }

  async function handleSignup() {
    if (!signup.firstName.trim() || !phoneValid) {
      toast.error("Please enter your name and a valid mobile number");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    const name = `${signup.firstName} ${signup.lastName}`.trim();
    completeAuth(name, signup.email.trim() || `${phone}@customer.monginis`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md"
      >
        {/* Brand header — solid brown, no gradients (design system) */}
        <div className="relative bg-bakery-700 px-6 pt-8 pb-7 text-center text-white">
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="absolute top-3 right-3 text-white/90 hover:bg-white/15 hover:text-white"
              />
            }
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </DialogClose>

          <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 text-white">
            {step === "signup" ? (
              <UserPlus className="size-6" />
            ) : step === "otp" ? (
              <ShieldCheck className="size-6" />
            ) : (
              <User className="size-6" />
            )}
          </span>
          <h2 className="font-heading text-2xl font-bold">
            {step === "signup"
              ? "Create Account"
              : step === "otp"
                ? "Verify OTP"
                : "Craving Something Sweet?"}
          </h2>
          <p className="mt-1.5 text-sm text-white/85">
            {step === "signup"
              ? "Join us for delicious treats!"
              : step === "otp"
                ? `We sent a code to +91 ${displayPhone}`
                : "Login to explore freshly baked happiness"}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {step === "phone" ? (
            <PhoneStep
              phone={phone}
              setPhone={setPhone}
              phoneValid={phoneValid}
              loading={loading}
              onSubmit={handleSendOtp}
              onSignup={() => setStep("signup")}
            />
          ) : step === "otp" ? (
            <OtpStep
              otp={otp}
              otpRefs={otpRefs}
              otpValid={otpValid}
              loading={loading}
              resendIn={resendIn}
              onChange={handleOtpChange}
              onKeyDown={handleOtpKeyDown}
              onPaste={handleOtpPaste}
              onVerify={handleVerify}
              onResend={handleSendOtp}
              onChangeNumber={() => setStep("phone")}
            />
          ) : (
            <SignupStep
              signup={signup}
              setSignup={setSignup}
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              onSubmit={handleSignup}
              onLogin={() => setStep("phone")}
            />
          )}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href={routes.store.terms} className="font-medium text-bakery-700 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href={routes.store.privacy} className="font-medium text-bakery-700 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhoneStep({
  phone,
  setPhone,
  phoneValid,
  loading,
  onSubmit,
  onSignup,
}: {
  phone: string;
  setPhone: (v: string) => void;
  phoneValid: boolean;
  loading: boolean;
  onSubmit: () => void;
  onSignup: () => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="auth-phone">Mobile Number</Label>
        <div className="flex items-center overflow-hidden rounded-lg border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="flex h-10 items-center border-r border-border bg-cream-100 px-3 text-sm font-medium text-foreground">
            +91
          </span>
          <input
            id="auth-phone"
            type="tel"
            inputMode="numeric"
            autoFocus
            placeholder="Enter 10-digit number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="h-10 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <Button type="submit" variant="bakery" className="w-full" disabled={!phoneValid || loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? "Sending OTP…" : "Get OTP"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSignup}
          className="font-semibold text-bakery-700 hover:underline"
        >
          Sign up
        </button>
      </p>
    </form>
  );
}

function OtpStep({
  otp,
  otpRefs,
  otpValid,
  loading,
  resendIn,
  onChange,
  onKeyDown,
  onPaste,
  onVerify,
  onResend,
  onChangeNumber,
}: {
  otp: string[];
  otpRefs: React.RefObject<Array<HTMLInputElement | null>>;
  otpValid: boolean;
  loading: boolean;
  resendIn: number;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onVerify: () => void;
  onResend: () => void;
  onChangeNumber: () => void;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onVerify();
      }}
    >
      <div className="space-y-2.5">
        <p className="text-center text-sm font-medium text-foreground">Enter {OTP_LENGTH}-digit OTP</p>
        <div className="flex justify-center gap-2.5" onPaste={onPaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                otpRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => onChange(index, e.target.value)}
              onKeyDown={(e) => onKeyDown(index, e)}
              className="size-12 rounded-xl border border-input bg-white text-center font-heading text-xl font-bold text-foreground outline-none focus:border-bakery-500 focus:ring-3 focus:ring-bakery-200"
            />
          ))}
        </div>
      </div>

      <Button type="submit" variant="bakery" className="w-full" disabled={!otpValid || loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? "Verifying…" : "Verify & Login"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t receive the code?{" "}
        {resendIn > 0 ? (
          <span className="text-muted-foreground">Resend in {resendIn}s</span>
        ) : (
          <button type="button" onClick={onResend} className="font-semibold text-bakery-700 hover:underline">
            Resend OTP
          </button>
        )}
      </p>

      <button
        type="button"
        onClick={onChangeNumber}
        className="mx-auto flex items-center gap-1.5 text-sm font-medium text-bakery-700 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Change mobile number
      </button>
    </form>
  );
}

function SignupStep({
  signup,
  setSignup,
  phone,
  setPhone,
  loading,
  onSubmit,
  onLogin,
}: {
  signup: { firstName: string; lastName: string; dob: string; email: string };
  setSignup: React.Dispatch<
    React.SetStateAction<{ firstName: string; lastName: string; dob: string; email: string }>
  >;
  phone: string;
  setPhone: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onLogin: () => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="su-first">First Name</Label>
          <Input
            id="su-first"
            placeholder="First name"
            value={signup.firstName}
            onChange={(e) => setSignup((s) => ({ ...s, firstName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="su-last">Last Name</Label>
          <Input
            id="su-last"
            placeholder="Last name"
            value={signup.lastName}
            onChange={(e) => setSignup((s) => ({ ...s, lastName: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="su-dob">
          Date of Birth <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          id="su-dob"
          type="date"
          value={signup.dob}
          onChange={(e) => setSignup((s) => ({ ...s, dob: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="su-email">
          Email Address <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          id="su-email"
          type="email"
          placeholder="Enter your email"
          value={signup.email}
          onChange={(e) => setSignup((s) => ({ ...s, email: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="su-phone">Mobile Number</Label>
        <div className="flex items-center overflow-hidden rounded-lg border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="flex h-10 items-center border-r border-border bg-cream-100 px-3 text-sm font-medium text-foreground">
            +91
          </span>
          <input
            id="su-phone"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="h-10 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <Button type="submit" variant="bakery" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? "Creating account…" : "Sign Up"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-bakery-700 hover:underline">
          Login
        </button>
      </p>
    </form>
  );
}
