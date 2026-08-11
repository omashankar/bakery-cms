"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ChevronRight, Heart, LifeBuoy, Loader2, MapPin, Package } from "lucide-react";
import { toast } from "sonner";
import { AccountShell } from "@/apps/website/account/components/account-shell";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import { updateCustomerProfile } from "@/apps/website/account/lib/customer-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
};

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
  const { session, ready } = useCustomerAuth();
  const { register, handleSubmit, formState, reset } = useForm<ProfileForm>();

  useEffect(() => {
    if (!session) return;
    const { firstName, lastName } = splitName(session.name);
    reset({ firstName, lastName, email: session.email });
  }, [session, reset]);

  const resetForm = () => {
    if (!session) return;
    const { firstName, lastName } = splitName(session.name);
    reset({ firstName, lastName, email: session.email });
  };

  const onSubmit = async (data: ProfileForm) => {
    const name = `${data.firstName} ${data.lastName}`.trim();

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
    const updated = await updateCustomerProfile({ name });
    if (!updated) {
      toast.error("Could not update your profile", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    toast.success("Profile updated");
  };

  if (!ready || !session) {
    return null;
  }

  return (
    <AccountShell
      title="My Profile"
      description="Manage your personal details and quick access to your activity."
    >
      {/* Personal Information */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-heading text-lg font-bold text-foreground">
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
              <Input id="email" type="email" value={session.email} readOnly disabled />
              <p className="text-xs text-muted-foreground">
                Your orders are matched to this address. To use another one, sign in with it.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                type="tel"
                value={session.phone ?? ""}
                readOnly
                disabled
                className="cursor-not-allowed bg-cream-50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Mobile number cannot be changed
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              onClick={resetForm}
              disabled={formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="bakery"
              className="sm:flex-1"
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
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-heading text-lg font-bold text-foreground">Quick Links</h2>
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
    </AccountShell>
  );
}
