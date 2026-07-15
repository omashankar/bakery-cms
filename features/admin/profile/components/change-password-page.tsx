"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface StrengthResult {
  score: number; // 0-4
  label: string;
  tone: string;
}

function scorePassword(pw: string): StrengthResult {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length >= 12 && score >= 3) score = 4;

  const meta = [
    { label: "Very weak", tone: "bg-red-500" },
    { label: "Weak", tone: "bg-red-500" },
    { label: "Fair", tone: "bg-amber-500" },
    { label: "Good", tone: "bg-lime-500" },
    { label: "Strong", tone: "bg-green-600" },
  ];
  return { score, ...meta[score] };
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Upper & lowercase letters", test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: "At least one number", test: (p: string) => /\d/.test(p) },
  { label: "At least one symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => scorePassword(next), [next]);
  const mismatch = confirm.length > 0 && confirm !== next;

  const canSubmit =
    current.length > 0 && next.length >= 8 && confirm === next && next !== current;

  async function handleSubmit() {
    if (!current) return toast.error("Enter your current password");
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next === current) return toast.error("New password must differ from the current one");
    if (confirm !== next) return toast.error("Passwords do not match");

    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password updated", {
      description: "Use your new password the next time you sign in.",
    });
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Change Password"
        description="Keep your account secure with a strong password."
        actions={
          <Button variant="outline" className="w-full sm:w-auto" render={<Link href={routes.admin.profile} />}>
            <ArrowLeft className="size-4" />
            Back to profile
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <KeyRound className="size-4 text-bakery-700" />
            <CardTitle className="text-base">Update Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PasswordField id="current" label="Current Password" value={current} onChange={setCurrent} placeholder="Enter current password" />

            <div className="space-y-2">
              <PasswordField id="new" label="New Password" value={next} onChange={setNext} placeholder="Enter new password" />
              {next ? (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          i < strength.score ? strength.tone : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Strength: <span className="font-medium text-foreground">{strength.label}</span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <PasswordField id="confirm" label="Confirm Password" value={confirm} onChange={setConfirm} placeholder="Re-enter new password" />
              {mismatch ? (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              ) : confirm && confirm === next ? (
                <p className="flex items-center gap-1 text-xs text-green-700">
                  <Check className="size-3" /> Passwords match
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button variant="bakery" onClick={handleSubmit} disabled={!canSubmit || saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {saving ? "Updating…" : "Update password"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Requirements checklist */}
        <Card className="h-fit shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Password requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {RULES.map((rule) => {
              const ok = rule.test(next);
              return (
                <div key={rule.label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      ok ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {ok ? <Check className="size-3" /> : <X className="size-3" />}
                  </span>
                  <span className={ok ? "text-foreground" : "text-muted-foreground"}>{rule.label}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
