"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adoptCustomerSession } from "@/apps/website/account/lib/customer-session";
import { routes } from "@/constants/routes";

/**
 * Signing in to the storefront, for real.
 *
 * This modal used to simulate the whole thing: `await new Promise(r =>
 * setTimeout(r, 700))` and then it declared you signed in. No code was ever
 * sent, any five digits were accepted, and the identity it minted was
 * `<phone>@customer.local` — an address that appears on no order the shop has
 * ever taken, which is why My Orders could never find anything.
 *
 * It is now an EMAIL and a one-time code, because email is what an order is
 * keyed on (`address.email`). Proving control of that address is therefore the
 * same act as proving the orders are yours, and the account and the history
 * cannot drift apart. The phone number is still collected — the bakery rings
 * customers — but it is a detail on the account, not the identity.
 */

type Step = "email" | "code";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/** Fire from anywhere to open the single customer auth modal (lives in the navbar). */
export const OPEN_AUTH_MODAL_EVENT = "bakery-open-auth-modal";

export function openCustomerAuthModal(step: "phone" | "signup" = "phone") {
  if (typeof window === "undefined") return;
  // The two names are kept for the call sites that use them; both open the same
  // flow, because with an emailed code there is no separate sign-up — the first
  // successful sign-in for an address creates the account.
  window.dispatchEvent(new CustomEvent(OPEN_AUTH_MODAL_EVENT, { detail: { step } }));
}

interface CustomerAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: "phone" | "signup";
  /** Called after a successful sign-in. */
  onAuthenticated?: () => void;
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; data?: unknown; message?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const parsed = (await res.json().catch(() => null)) as
      | { data?: unknown; message?: string }
      | null;
    return { ok: res.ok, data: parsed?.data, message: parsed?.message };
  } catch {
    return { ok: false, message: "Could not reach the bakery. Check your connection." };
  }
}

export function CustomerAuthModal({
  open,
  onOpenChange,
  onAuthenticated,
}: CustomerAuthModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Reset the flow after close so it reopens clean.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setStep("email");
      setCode(Array(CODE_LENGTH).fill(""));
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeValue = code.join("");
  const codeValid = codeValue.length === CODE_LENGTH;

  function handleCodeChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) codeRefs.current[index + 1]?.focus();
  }

  function handleCodeKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((digit, index) => (next[index] = digit));
    setCode(next);
    codeRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  /**
   * Ask the shop to email a code.
   *
   * The step only advances when the SERVER says the email went out. It used to
   * advance on a timer, so a customer waiting for a code that had never been
   * sent had no way to tell that from one that was slow.
   */
  async function handleSendCode() {
    if (!emailValid || loading) return;
    setLoading(true);
    const result = await postJson("/api/customer-auth/request-code", {
      email: email.trim(),
      name: name.trim() || undefined,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message ?? "Could not send your code");
      return;
    }

    setStep("code");
    setCode(Array(CODE_LENGTH).fill(""));
    setResendIn(RESEND_SECONDS);
    setTimeout(() => codeRefs.current[0]?.focus(), 50);
    toast.success("Code sent", { description: `Check ${email.trim()} for a 6-digit code.` });
  }

  async function handleVerify() {
    if (!codeValid || loading) return;
    setLoading(true);
    const result = await postJson("/api/customer-auth/verify", {
      email: email.trim(),
      code: codeValue,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message ?? "That code is not right");
      setCode(Array(CODE_LENGTH).fill(""));
      codeRefs.current[0]?.focus();
      return;
    }

    const identity = result.data as { email: string; name: string; phone?: string };
    adoptCustomerSession({
      email: identity.email,
      // A first-time customer with no orders has no name on file; use whatever
      // they typed rather than showing them a blank account menu.
      name: identity.name || name.trim(),
      phone: identity.phone,
    });

    onOpenChange(false);
    onAuthenticated?.();
    // No shop name in the greeting.
    //
    // It came from `getStorefrontBrandInfo()`, which reads the client settings
    // cache — and that cache persists the shipped SEED when the storage key is
    // absent, so a visitor whose settings request was blocked was welcomed to a
    // shop that does not exist. This modal opens through a global imperative
    // API with no server prop to thread, and a greeting does not need the name
    // to do its job: the customer is looking at the shop.
    toast.success("Signed in", { description: "Welcome back!" });
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
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </DialogClose>

          <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 text-white">
            {step === "code" ? <ShieldCheck className="size-6" /> : <Mail className="size-6" />}
          </span>
          <h2 className="font-heading text-xl font-bold">
            {step === "code" ? "Enter your code" : "Sign in"}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            {step === "code"
              ? `We sent a ${CODE_LENGTH}-digit code to ${email.trim()}`
              : "See your orders, addresses and wishlist"}
          </p>
        </div>

        <div className="px-6 py-6">
          {step === "email" ? (
            <EmailStep
              email={email}
              setEmail={setEmail}
              name={name}
              setName={setName}
              emailValid={emailValid}
              loading={loading}
              onSubmit={handleSendCode}
            />
          ) : (
            <CodeStep
              code={code}
              codeRefs={codeRefs}
              codeValid={codeValid}
              loading={loading}
              resendIn={resendIn}
              onChange={handleCodeChange}
              onKeyDown={handleCodeKeyDown}
              onPaste={handleCodePaste}
              onVerify={handleVerify}
              onResend={handleSendCode}
              onChangeEmail={() => setStep("email")}
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

function EmailStep({
  email,
  setEmail,
  name,
  setName,
  emailValid,
  loading,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  emailValid: boolean;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email address</Label>
        <Input
          id="auth-email"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {/*
          Said plainly, because it is the whole reason this is an email and not
          a phone number: the account finds your orders by matching this
          against the address they were placed with.
        */}
        <p className="text-xs text-muted-foreground">
          Use the same address you order with — that is how we find your orders.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-name">
          Your name <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="auth-name"
          autoComplete="name"
          placeholder="For your first order"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <Button type="submit" variant="bakery" className="w-full" disabled={!emailValid || loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {loading ? "Sending code…" : "Email me a code"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        No password needed. New here? Your account is created the first time you sign in.
      </p>
    </form>
  );
}

function CodeStep({
  code,
  codeRefs,
  codeValid,
  loading,
  resendIn,
  onChange,
  onKeyDown,
  onPaste,
  onVerify,
  onResend,
  onChangeEmail,
}: {
  code: string[];
  codeRefs: React.RefObject<Array<HTMLInputElement | null>>;
  codeValid: boolean;
  loading: boolean;
  resendIn: number;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onVerify: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onVerify();
      }}
    >
      <div className="space-y-2.5">
        <p className="text-center text-sm font-medium text-foreground">
          Enter the {CODE_LENGTH}-digit code
        </p>
        <div className="flex justify-center gap-2" onPaste={onPaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                codeRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              aria-label={`Code digit ${index + 1}`}
              value={digit}
              onChange={(event) => onChange(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(index, event)}
              className="size-11 rounded-xl border border-input bg-background text-center font-heading text-xl font-bold text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
          ))}
        </div>
      </div>

      <Button type="submit" variant="bakery" className="w-full" disabled={!codeValid || loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? "Checking…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{" "}
        {resendIn > 0 ? (
          <span className="text-muted-foreground">Resend in {resendIn}s</span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            className="font-semibold text-bakery-700 hover:underline"
          >
            Send another
          </button>
        )}
      </p>

      <button
        type="button"
        onClick={onChangeEmail}
        className="mx-auto flex items-center gap-1.5 text-sm font-medium text-bakery-700 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Use a different email
      </button>
    </form>
  );
}
