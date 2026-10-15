"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ChevronRight, Heart, LifeBuoy, Loader2, MapPin, Package } from "lucide-react";
import { toast } from "@/lib/lazy-toast";
import { useAccountProfile } from "@/apps/website/account/components/account-context";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import { updateCustomerProfile } from "@/apps/website/account/lib/customer-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <>
      {/* Personal Information */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h2 className={cn(storefrontHeading.card, "text-foreground")}>
          Personal Information
        </h2>
        <div className="mt-1 h-px bg-border" />

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register("firstName", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register("lastName")} />
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
              <Input id="email" type="email" value={session?.email ?? profile?.email ?? ""} readOnly disabled />
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
              <Input
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

          {/* Right-aligned and sized to their words on a wide screen; two
              800px-wide buttons read as a banner, not as a form's end. */}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 sm:min-w-32"
              onClick={resetForm}
              disabled={formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="bakery"
              className="h-10 sm:min-w-32"
              disabled={formState.isSubmitting}
            >
              {formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {formState.isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>

      {/* Quick Links */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h2 className={cn(storefrontHeading.card, "text-foreground")}>Quick Links</h2>
        <div className="mt-1 h-px bg-border" />

        <div className="mt-4 divide-y divide-border">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-4 py-4 transition-colors"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream-100 text-bakery-700 transition-colors group-hover:bg-bakery-700 group-hover:text-white">
                <link.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {link.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {link.description}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-bakery-700" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
