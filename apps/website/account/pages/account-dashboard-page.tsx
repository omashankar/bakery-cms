"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  Camera,
  Check,
  ChevronRight,
  Heart,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "@/lib/lazy-toast";
import { EditableAvatar } from "@/apps/website/account/components/account-avatar";
import { displayNameOf, useAccountProfile } from "@/apps/website/account/components/account-context";
import { useAvatarEditor } from "@/apps/website/account/hooks/use-avatar-editor";
import { ACCOUNT_ACTION, ACCOUNT_CARD_FOOTER } from "@/apps/website/account/lib/account-buttons";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import { updateCustomerProfile } from "@/apps/website/account/lib/customer-session";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/apps/website/account/components/icon-input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { storefrontHeading } from "@/constants/typography";
import { cn } from "@/lib/utils";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

/** A 10-digit Indian mobile, with or without +91 / 0 in front; blank is allowed. */
const MOBILE = /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/;

const quickLinks = [
  {
    href: routes.account.orders,
    label: "My Orders",
    description: "View your order history",
    icon: Package,
  },
  {
    href: routes.account.addresses,
    label: "My Addresses",
    description: "Manage your saved addresses",
    icon: MapPin,
  },
  {
    href: routes.store.wishlist,
    label: "Wishlist",
    description: "View your favorite items",
    icon: Heart,
  },
  {
    href: routes.store.contact,
    label: "Help & Support",
    description: "Get help with your orders",
    icon: LifeBuoy,
  },
] as const;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function AccountDashboardPage() {
  const { session } = useCustomerAuth();
  // The server's answer fills the form in the first paint; the browser
  // session takes over once it is read (after an edit, for one).
  const profile = useAccountProfile();
  const avatar = useAvatarEditor();
  const { register, handleSubmit, formState, reset } = useForm<ProfileForm>({
    defaultValues: profile
      ? { ...splitName(profile.name), email: profile.email, phone: profile.phone }
      : undefined,
  });

  useEffect(() => {
    if (!session) return;
    const { firstName, lastName } = splitName(session.name);
    reset({ firstName, lastName, email: session.email, phone: session.phone ?? "" });
  }, [session, reset]);

  const resetForm = () => {
    const source = session ?? profile;
    if (!source) return;
    const { firstName, lastName } = splitName(source.name);
    reset({ firstName, lastName, email: source.email, phone: source.phone ?? "" });
  };

  const onSubmit = async (data: ProfileForm) => {
    const name = `${data.firstName} ${data.lastName}`.trim();
    const phone = data.phone.trim();

    /**
     * Saved on the SERVER, and only reported when the server says so.
     *
     * This wrote to localStorage and toasted "Profile updated" regardless —
     * over a write that had not necessarily happened, and onto a copy no other
     * device would ever see.
     *
     * The EMAIL is not in this payload and the field is read-only below. It is
     * the account key and the key every order is matched on, so editing it here
     * used to disconnect a customer from their entire history under a success
     * toast. Moving to another address now means signing in as that address and
     * proving it, which is the only version of the change that can be true.
     */
    const updated = await updateCustomerProfile({ name, phone });
    if (!updated) {
      toast.error("Could not update your profile", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    toast.success("Profile updated");
  };

  // No blank wait for the browser session any more: the layout has already
  // signed the customer in on the server, and that blank was the flash
  // between tabs.
  if (!session && !profile) return null;

  const displayName = session
    ? session.name || session.email.split("@")[0] || ""
    : profile
      ? displayNameOf(profile)
      : "";
  // A session cached before photos existed has no field; "" is a removal.
  const avatarUrl = session?.avatarUrl ?? profile?.avatarUrl ?? "";

  return (
    <>
      {/* Personal Information */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* The same header band as an order card, so the account pages read as one set. */}
        <header className="border-b border-border bg-cream-50 px-5 py-4 sm:px-6">
          <h2 className={cn(storefrontHeading.card, "text-foreground")}>Personal Information</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Your photo, your name and how we reach you</p>
        </header>

        <div className="p-5 sm:p-6">
          {/*
            THE PHOTO, above the fields it belongs with, in a panel of its own
            so it reads as one thing with its buttons. Here as well as on the
            sidebar's avatar because the sidebar is hidden on a phone, and this
            is the one place with room for Remove beside Change. On a phone the
            buttons drop to a full-width row under it.
          */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-4 rounded-xl border border-border bg-cream-50 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:p-5">
            <EditableAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              busy={avatar.busy}
              onChoose={avatar.choose}
              className="size-20 bg-bakery-700 text-xl text-white shadow-sm ring-4 ring-card"
            />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Profile photo</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {avatarUrl
                  ? "Shown on your account and in the shop's header."
                  : "Add a photo so your account feels like yours."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP, up to 6 MB</p>
            </div>
            <div className="col-span-2 grid grid-flow-col auto-cols-fr gap-2 sm:col-span-1 sm:flex">
              <Button
                type="button"
                variant="outline"
                onClick={avatar.choose}
                disabled={avatar.busy}
                className={cn(ACCOUNT_ACTION, "bg-card")}
              >
                <Camera className="size-4" aria-hidden />
                {avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void avatar.remove()}
                  disabled={avatar.busy}
                  className={cn(
                    ACCOUNT_ACTION,
                    "border-destructive/30 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
            <input {...avatar.inputProps} />
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <IconInput icon={User} id="firstName" autoComplete="given-name" {...register("firstName", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <IconInput icon={User} id="lastName" autoComplete="family-name" {...register("lastName")} />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                {/*
                  Read-only, because it is the account. Every order is matched to
                  a customer by the address it was placed with, so editing it here
                  used to leave the account pointing at an address with no orders
                  under it — My Orders emptied itself and said "No orders yet",
                  beneath a toast reading "Profile updated".
                */}
                <IconInput
                  icon={Mail}
                  id="email"
                  type="email"
                  value={session?.email ?? profile?.email ?? ""}
                  readOnly
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Your orders are matched to this address. To use another one, sign in with it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                {/*
                  EDITABLE. It said "cannot be changed", but this account signs in
                  with an email and a code — the phone is a contact detail, and
                  the profile endpoint has always taken it. A customer who signed
                  up without one could never add it.
                */}
                <IconInput
                  icon={Phone}
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  aria-invalid={formState.errors.phone ? true : undefined}
                  {...register("phone", {
                    validate: (value) =>
                      !value.trim() || MOBILE.test(value.replace(/\s+/g, "")) ||
                      "Enter a 10-digit mobile number",
                  })}
                />
                <p
                  className={cn(
                    "text-xs",
                    formState.errors.phone ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {formState.errors.phone?.message ?? "We call this number if a delivery needs it."}
                </p>
              </div>
            </div>

            {/*
              The card's closing band, as an order card ends. Both buttons
              wait for an edit: a live Save over an unchanged form invited a
              press that did nothing, and the left of the band says when
              there is something to save.
            */}
            <div className={ACCOUNT_CARD_FOOTER}>
              {/* The left of the band, as an order card's: a note, or the edit waiting to be saved. */}
              {formState.isDirty ? (
                <p className="mr-auto flex items-center gap-2 text-xs font-medium text-bakery-700">
                  <span className="size-2 rounded-full bg-gold-400" aria-hidden />
                  You have unsaved changes
                </p>
              ) : (
                <p className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden />
                  Only used for your orders and deliveries
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className={cn(ACCOUNT_ACTION, "min-w-28 bg-card")}
                onClick={resetForm}
                disabled={formState.isSubmitting || !formState.isDirty}
              >
                <X className="size-4" aria-hidden />
                Cancel
              </Button>
              <Button
                type="submit"
                variant="bakery"
                className={cn(ACCOUNT_ACTION, "min-w-32")}
                disabled={formState.isSubmitting || !formState.isDirty}
              >
                {formState.isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {formState.isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Quick Links */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="border-b border-border bg-cream-50 px-5 py-4 sm:px-6">
          <h2 className={cn(storefrontHeading.card, "text-foreground")}>Quick Links</h2>
        </header>

        {/* Tiles, two across from sm: four full-width rows were a tall list of short words. */}
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-xl border border-border p-3.5 transition-colors hover:border-bakery-300 hover:bg-cream-50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream-100 text-bakery-700 transition-colors group-hover:bg-bakery-700 group-hover:text-white">
                <link.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {link.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {link.description}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-bakery-700" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
