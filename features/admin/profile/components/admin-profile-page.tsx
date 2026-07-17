"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Camera,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import {
  getAdminProfile,
  saveAdminProfile,
  type AdminProfile,
} from "@/features/admin/profile/lib/admin-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { formatDate } from "@/utils/format";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState({ fullName: "", mobile: "", username: "", photoUrl: "" });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = getAdminProfile();
    setProfile(p);
    setForm({ fullName: p.fullName, mobile: p.mobile, username: p.username, photoUrl: p.photoUrl });
  }, []);

  const isDirty = profile
    ? form.fullName !== profile.fullName ||
      form.mobile !== profile.mobile ||
      form.username !== profile.username ||
      form.photoUrl !== profile.photoUrl
    : false;

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function resetForm() {
    if (!profile) return;
    setForm({
      fullName: profile.fullName,
      mobile: profile.mobile,
      username: profile.username,
      photoUrl: profile.photoUrl,
    });
  }

  function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large — keep it under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error("Could not read that image");
    reader.onload = () => setForm((f) => ({ ...f, photoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));

    if (!saveAdminProfile(form)) {
      setSaving(false);
      toast.error("Could not save — the photo may be too large for browser storage");
      return;
    }

    // Re-seed the form from the saved profile so trimmed values clear the dirty state.
    const fresh = getAdminProfile();
    setProfile(fresh);
    setForm({
      fullName: fresh.fullName,
      mobile: fresh.mobile,
      username: fresh.username,
      photoUrl: fresh.photoUrl,
    });
    setSaving(false);
    toast.success("Profile updated");
  }

  if (!profile) {
    return (
      <AdminPage className="space-y-4 sm:space-y-5">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-muted" />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="My Profile"
        description="Manage your account details and profile photo."
        actions={
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href={routes.admin.changePassword} />}
          >
            <KeyRound className="size-4" />
            Change password
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
        {/* Summary card */}
        <Card className="overflow-hidden shadow-sm">
          <div className="bg-bakery-700 px-6 pt-8 pb-6 text-center text-white">
            <div className="relative mx-auto w-fit">
              <span className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/15 text-2xl font-bold">
                {form.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photoUrl} alt={profile.fullName} className="size-full object-cover" />
                ) : (
                  initials(form.fullName || profile.fullName)
                )}
              </span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-bakery-700 bg-white text-bakery-700 shadow-sm transition-colors hover:bg-cream-100"
                aria-label="Change photo"
              >
                <Camera className="size-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>
            <p className="mt-3 truncate font-heading text-lg font-bold">
              {form.fullName || profile.fullName}
            </p>
            <p className="truncate text-sm text-white/75">{profile.email}</p>
          </div>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="accent" className="gap-1">
                <ShieldCheck className="size-3" />
                {profile.role}
              </Badge>
              <Badge variant="success" className="gap-1">
                <BadgeCheck className="size-3" />
                {profile.status}
              </Badge>
            </div>
            <div className="space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="size-4 shrink-0" />
                Last login {formatDate(profile.lastLogin)}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-4 shrink-0" />
                Member since {formatDate(profile.createdAt)}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Editable details */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profile.email}
                      readOnly
                      disabled
                      className="cursor-not-allowed bg-muted pl-9 text-muted-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="bakeryowner"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetForm} disabled={saving || !isDirty}>
                  Cancel
                </Button>
                <Button variant="bakery" onClick={handleSave} disabled={saving || !isDirty}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Read-only account info */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border text-sm">
              {[
                { label: "Role", value: profile.role },
                { label: "Account Status", value: profile.status },
                { label: "Last Login", value: formatDate(profile.lastLogin) },
                { label: "Account Created", value: formatDate(profile.createdAt) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
