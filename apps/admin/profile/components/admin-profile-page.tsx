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
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import {
  getAdminProfile,
  saveAdminProfile,
  ADMIN_PROFILE_UPDATED_EVENT,
  type AdminProfile,
} from "@/features/auth/lib/admin-profile";
import { useHydratedForm } from "@/features/settings/lib/use-hydrated-form";
import { adminConfigHydration } from "@/features/admin-config/lib/admin-config-api";
import { ensureAdminConfigHydrated } from "@/features/admin-config/lib/admin-config-hydration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { formatDate } from "@/utils/format";
import { reportedAsSignedOut } from "@/apps/admin/lib/report-write";
import { uploadMediaRequest } from "@/apps/admin/media/lib/media-api";
import {
  MAX_INLINE_BYTES,
  MAX_SOURCE_BYTES,
} from "@/apps/admin/media/lib/use-media-upload";
import { shrinkImageFile } from "@/lib/images/shrink-image";

/** Shown only while hydration is pending, behind the skeleton. */
const EMPTY_PROFILE: AdminProfile = {
  fullName: "",
  email: "",
  mobile: "",
  username: "",
  photoUrl: "",
  role: "",
  status: "Active",
  lastLogin: "",
  createdAt: "",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AdminProfilePage() {
  // The shared hydrated form. This page read `getAdminProfile()` once on mount
  // with no gate — and that read DERIVES a placeholder profile from the signed-in
  // email when the local blob is absent, which on a hard load it is. Saving is a
  // whole-blob replace, so one edit to the mobile number pushed that derived
  // placeholder over the admin's real name, username and photo.
  const {
    value: form,
    saved: profile,
    isDirty,
    hydration,
    isWriting: saving,
    canSave,
    edit,
    set,
    runWrite,
  } = useHydratedForm<AdminProfile>({
    read: getAdminProfile,
    fallback: EMPTY_PROFILE,
    gate: adminConfigHydration,
    ensureHydrated: ensureAdminConfigHydrated,
    updatedEvent: ADMIN_PROFILE_UPDATED_EVENT,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * A photo now leaves the browser, so there is a wait where there was none.
   *
   * Without this the camera button looks inert for as long as the upload
   * takes, and the obvious thing to do with a button that did nothing is
   * press it again.
   */
  const [uploading, setUploading] = useState(false);

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
    set(profile);
  }

  /**
   * The one photo box in this admin that never learned to upload.
   *
   * It read the file straight into a data URI and stored the whole picture as
   * text — a 2 MB limit that a phone camera clears in one shot, and base64 adds
   * a third on top. That string went into localStorage with the rest of the
   * admin config, which browsers cap near 5 MB, so a single profile photo could
   * fill the cache on its own and every later save would throw. One did: 2.3 MB
   * of this shop's 16 MB of pasted images was this field.
   *
   * Everything it needed already existed. `shrinkImageFile` and
   * `uploadMediaRequest` are what the media library and every product photo
   * have used for a long time; this box simply never called them.
   *
   * The three outcomes are kept apart deliberately, and the reason is written
   * up at `media-api.ts`: treating a REFUSED upload as "no image host" is how a
   * shop that had Cloudinary configured silently went back to writing base64
   * under a green success toast, while being told to add credentials it already
   * had.
   */
  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Cleared so choosing the same file again still fires a change.
    event.target.value = "";

    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("That file is too large to open");
      return;
    }

    setUploading(true);
    try {
      const { dataUrl, bytes } = await shrinkImageFile(file);
      const outcome = await uploadMediaRequest(dataUrl, "bakery-cms/profile");

      if (outcome.status === "uploaded") {
        edit((current) => ({ ...current, photoUrl: outcome.asset.url }));
        return;
      }

      if (outcome.status === "failed") {
        toast.error("Could not upload that photo", {
          description: "Your image host refused it. Check the account, then try again.",
        });
        return;
      }

      // No image host at all. The picture is stored as text, in this browser's
      // localStorage and in one Mongo document, so it has to stay small — and
      // the shop is told why rather than finding out when a save starts failing.
      if (bytes > MAX_INLINE_BYTES) {
        toast.error("Image storage is not configured", {
          description: `Without an image host, a photo must stay under ${Math.round(
            MAX_INLINE_BYTES / 1024,
          )} KB. Add Cloudinary credentials, or paste a hosted image URL instead.`,
          duration: 10000,
        });
        return;
      }

      edit((current) => ({ ...current, photoUrl: dataUrl }));
    } catch {
      toast.error("Could not read that image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!canSave) return;
    await runWrite(async () => {
      // Awaited, not just truthy-checked: this returns a Promise, and a bare
      // `if (!promise)` is always false — the guard would be dead.
      const accepted = await saveAdminProfile(form);
      if (!accepted) {
        if (!reportedAsSignedOut()) toast.error("Profile was not saved", {
          description: "The server rejected it, or the photo is too large for browser storage.",
        });
        // The working copy stays as typed so the admin can retry; the saved
        // baseline does not move, which is what keeps Save live.
        return { value: form, accepted: false };
      }

      // Re-read so trimmed values clear the dirty state.
      toast.success("Profile updated");
      return { value: getAdminProfile(), accepted: true };
    });
  }

  // Behind the skeleton until the SERVER's copy has landed. Gating only the
  // Save button leaves the gap open: the admin edits the derived placeholder,
  // the arriving values are skipped because the form is dirty, and Save then
  // unlocks over it.
  if (hydration === "pending") {
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
                disabled={uploading}
                className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-bakery-700 bg-white text-bakery-700 shadow-sm transition-colors hover:bg-cream-100 disabled:opacity-70"
                aria-label={uploading ? "Uploading photo" : "Change photo"}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
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
                    onChange={(e) => edit((f) => ({ ...f, fullName: e.target.value }))}
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
                    onChange={(e) => edit((f) => ({ ...f, mobile: e.target.value }))}
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
                    onChange={(e) => edit((f) => ({ ...f, username: e.target.value }))}
                    placeholder="bakeryowner"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetForm} disabled={saving || !isDirty}>
                  Cancel
                </Button>
                {/* Gated on hydration, not only inside the handler: a button
                    that looks available and refuses after the click tells the
                    admin nothing about why. */}
                <Button
                  variant="bakery"
                  onClick={handleSave}
                  disabled={saving || !isDirty || !canSave}
                >
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
