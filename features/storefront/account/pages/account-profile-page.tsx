"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AccountShell } from "@/features/storefront/account/components/account-shell";
import { useCustomerAuth } from "@/features/storefront/account/hooks/use-customer-auth";
import { updateCustomerProfile } from "@/features/storefront/account/lib/customer-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
};

export function AccountProfilePage() {
  const { session, ready } = useCustomerAuth();
  const { register, handleSubmit, formState, reset } = useForm<ProfileForm>();

  useEffect(() => {
    if (!session) return;
    reset({
      name: session.name,
      email: session.email,
      phone: session.phone ?? "",
    });
  }, [session, reset]);

  const onSubmit = async (data: ProfileForm) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    updateCustomerProfile(data);
    toast.success("Profile updated");
  };

  if (!ready || !session) {
    return null;
  }

  return (
    <AccountShell
      title="Profile Settings"
      description="Update your personal details used for orders and delivery."
      breadcrumbs={[{ label: "Profile" }]}
    >
      <div className="max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...register("phone", { required: true, minLength: 10 })}
            />
          </div>
          <Button type="submit" variant="bakery" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {formState.isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          UI-only profile storage. Changes are saved locally for this demo session.
        </p>
      </div>
    </AccountShell>
  );
}
