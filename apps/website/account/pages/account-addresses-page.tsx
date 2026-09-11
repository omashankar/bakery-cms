"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { formatAddress } from "@/features/orders/lib/address-format";
import {
  EMPTY_CHECKOUT_ADDRESS,
  type CheckoutAddress,
} from "@/features/orders/lib/checkout-draft";
import { toast } from "sonner";
import { AccountShell } from "@/apps/website/account/components/account-shell";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import {
  createSavedAddress,
  deleteSavedAddress,
  getSavedAddresses,
  setDefaultSavedAddress,
  updateSavedAddress,
  type SavedAddress,
} from "@/apps/website/account/lib/customer-addresses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The checkout's address, plus the two things only the book has.
 *
 * This was a hand-written copy of `CheckoutAddress` that did not extend it,
 * so widening the address left this screen behind — silently, because every
 * new field is optional. Built from the type now, so there is nothing left
 * to forget.
 */
type AddressForm = CheckoutAddress & {
  label: string;
  isDefault: boolean;
};

const emptyForm: AddressForm = {
  ...EMPTY_CHECKOUT_ADDRESS,
  label: "Home",
  addressLabel: "Home",
  isDefault: false,
};

/**
 * A saved record as the form wants it.
 *
 * Spread rather than listed, and over `emptyForm`, so a field added to the
 * address arrives here on its own and an older record without it yields a
 * string instead of `undefined`. The three storage keys are dropped because
 * the form has no business editing them.
 */
function toForm(address: SavedAddress): AddressForm {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = address;
  return { ...emptyForm, ...rest };
}

export function AccountAddressesPage() {
  const { session, ready } = useCustomerAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<AddressForm>({
    defaultValues: emptyForm,
  });

  const isDefault = watch("isDefault");
  // The 3-up control is not an <input>, so it is watched rather than registered.
  const watchedLabel = watch("label");

  useEffect(() => {
    const refresh = () => setAddresses(getSavedAddresses());
    refresh();
    window.addEventListener("bakery-addresses-updated", refresh);
    return () => window.removeEventListener("bakery-addresses-updated", refresh);
  }, []);

  useEffect(() => {
    if (!session || editingId) return;
    reset({
      ...emptyForm,
      fullName: session.name,
      email: session.email,
      phone: session.phone ?? "",
      isDefault: addresses.length === 0,
    });
  }, [session, addresses.length, editingId, reset]);

  function startEdit(address: SavedAddress) {
    setEditingId(address.id);
    // Listed field by field before, which made Edit destructive for anything
    // the list had not caught up with: the boxes opened blank and Update
    // wrote the blanks back over a good record.
    reset(toForm(address));
  }

  function cancelEdit() {
    setEditingId(null);
    if (session) {
      reset({
        ...emptyForm,
        fullName: session.name,
        email: session.email,
        phone: session.phone ?? "",
        isDefault: addresses.length === 0,
      });
    }
  }

  const onSubmit = async (data: AddressForm) => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (editingId) {
      updateSavedAddress(editingId, data);
      toast.success("Address updated");
      setEditingId(null);
    } else {
      createSavedAddress(data);
      toast.success("Address saved");
    }

    cancelEdit();
    setAddresses(getSavedAddresses());
  };

  if (!ready || !session) {
    return null;
  }

  return (
    <AccountShell
      title="Saved Addresses"
      description="Manage delivery addresses for faster checkout."
      breadcrumbs={[{ label: "Addresses" }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-cream-50 p-8 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream-100">
                <MapPin className="size-6 text-bakery-700" />
              </div>
              <p className="mt-4 font-heading font-bold text-foreground">No saved addresses</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first delivery address using the form.
              </p>
            </div>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                className={cn(
                  "rounded-2xl border bg-white p-5 shadow-sm sm:p-6",
                  address.isDefault ? "border-bakery-700 ring-1 ring-bakery-700/20" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading font-semibold">{address.label}</h3>
                      {address.isDefault ? <Badge variant="accent">Default</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {address.fullName} · {address.phone}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatAddress(address)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(address)}
                      aria-label="Edit address"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        deleteSavedAddress(address.id);
                        toast.success("Address removed");
                        setAddresses(getSavedAddresses());
                      }}
                      aria-label="Delete address"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {!address.isDefault ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setDefaultSavedAddress(address.id);
                      toast.success("Default address updated");
                      setAddresses(getSavedAddresses());
                    }}
                  >
                    Set as default
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="h-fit rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {editingId ? "Edit address" : "Add new address"}
          </h2>
          <div className="mt-1 h-px bg-border" />
          <form className="mt-5 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label>Label</Label>
              {/*
                The same three choices the checkout offers. Free text here
                and a three-way control there meant the two screens could
                disagree about what a label may even contain.
              */}
              <div role="radiogroup" aria-label="Label" className="grid grid-cols-3 gap-2">
                {(["Home", "Office", "Other"] as const).map((option) => {
                  const active = watchedLabel === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setValue("label", option);
                        setValue("addressLabel", option);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-bakery-700 bg-bakery-700 text-white"
                          : "border-border bg-white text-foreground hover:border-bakery-700"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" {...register("fullName", { required: true })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input id="addressLine1" {...register("addressLine1", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input id="addressLine2" {...register("addressLine2")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                placeholder="A shop, a turning, anything easy to spot"
                {...register("landmark")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="altPhone">Alternate phone</Label>
                <Input id="altPhone" {...register("altPhone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register("country")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register("city", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register("state", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">PIN code</Label>
              <Input
                id="pincode"
                {...register("pincode", {
                  required: true,
                  pattern: { value: /^\d{6}$/, message: "Enter 6-digit PIN" },
                })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(value) => setValue("isDefault", value === true)}
              />
              <Label htmlFor="isDefault" className="text-sm font-normal">
                Set as default address
              </Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" variant="bakery" disabled={formState.isSubmitting}>
                {editingId ? "Update address" : "Save address"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </AccountShell>
  );
}
