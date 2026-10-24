"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Building,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Hash,
  Home,
  Landmark,
  Loader2,
  Mail,
  MapIcon,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { stateForPincode } from "@/features/commerce/lib/india-states";
import {
  EMPTY_CHECKOUT_ADDRESS,
  type CheckoutAddress,
} from "@/features/orders/lib/checkout-draft";
import { toast } from "@/lib/lazy-toast";
import { useAccountProfile } from "@/apps/website/account/components/account-context";
import { useCustomerAuth } from "@/apps/website/account/hooks/use-customer-auth";
import {
  createSavedAddress,
  deleteSavedAddress,
  getSavedAddresses,
  setDefaultSavedAddress,
  syncSavedAddresses,
  updateSavedAddress,
  type SavedAddress,
} from "@/apps/website/account/lib/customer-addresses";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconInput } from "@/apps/website/account/components/icon-input";
import { AddressLabelIcon } from "@/apps/website/account/components/address-label-icon";
import { AddressSummary } from "@/apps/website/account/components/address-summary";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { storefrontHeading } from "@/constants/typography";
import { ACCOUNT_ACTION, ACCOUNT_CARD_FOOTER } from "@/apps/website/account/lib/account-buttons";

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
  // The shop delivers in India only, for now.
  country: "India",
  label: "Home",
  addressLabel: "Home",
  isDefault: false,
};

/** A 10-digit Indian mobile, with or without +91 / 0 in front. */
const MOBILE = /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/;

/**
 * What is wrong with a box, under it. Every field said only `required: true`,
 * so a bad save did nothing and said nothing.
 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

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
  const { session: browserSession } = useCustomerAuth();
  // The server's profile until the browser has read its own, so the page is
  // in the first paint instead of a blank wait between tabs.
  const profile = useAccountProfile();
  // Memoised: it is a dependency of the effect that resets the form, and a
  // fresh object every render would reset it every render.
  const session = useMemo(
    () => browserSession ?? (profile ? { ...profile, phone: profile.phone || undefined } : null),
    [browserSession, profile],
  );
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, getValues, watch, formState } = useForm<AddressForm>({
    defaultValues: emptyForm,
  });

  const isDefault = watch("isDefault");
  // The 3-up control is not an <input>, so it is watched rather than registered.
  const watchedLabel = watch("label");

  useEffect(() => {
    const refresh = () => setAddresses(getSavedAddresses());
    refresh();
    window.addEventListener("bakery-addresses-updated", refresh);
    // The account's book, which this device may not hold yet. Lands through
    // the event above when it differs.
    void syncSavedAddresses();
    return () => window.removeEventListener("bakery-addresses-updated", refresh);
  }, []);

  /*
    THE STATE FROM THE PIN, where the box is still empty — the same lookup the
    delivery zones use. Never over a state the customer typed themselves.
  */
  const watchedPincode = watch("pincode");
  useEffect(() => {
    const pin = (watchedPincode ?? "").trim();
    if (!/^\d{6}$/.test(pin) || getValues("state")?.trim()) return;
    const state = stateForPincode(pin);
    if (state) setValue("state", state, { shouldValidate: true });
  }, [watchedPincode, getValues, setValue]);

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
    // The form is above the list now; bring it into view.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormOpen(false);
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

  const onSubmit = (data: AddressForm) => {
    // A 400ms sleep stood here so the button looked busy. Nothing was busy.
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

  if (!session) {
    return null;
  }

  const showForm = formOpen || editingId !== null || addresses.length === 0;

  return (
    <>
      {/*
        ONE COLUMN BESIDE THE MENU: the form, only while adding or editing,
        then the saved cards two across under their own heading. The form
        used to stand open in a 360px third column — a page-long strip of
        fields beside one short card and a lot of nothing.

        THE FORM COMES FIRST, the heading after it. "Saved addresses (1)"
        sat above the form, so it labelled a blank "Add new address" form
        and the one saved address was a screen further down, under nothing.
      */}
      <div className="space-y-5">
        {showForm ? (
        <div className="h-fit overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* The header band every account card has. */}
          <header className="border-b border-border bg-cream-50 px-5 py-4 sm:px-6">
            <h2 className={cn(storefrontHeading.card, "text-foreground")}>
              {editingId ? "Edit address" : "Add new address"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Where we bring your order, and who to call when we are at the door
            </p>
          </header>
          <form className="space-y-4 p-5 sm:p-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label>Label</Label>
              {/*
                The same three choices the checkout offers. Free text here
                and a three-way control there meant the two screens could
                disagree about what a label may even contain.
              */}
              <div role="radiogroup" aria-label="Label" className="grid max-w-sm grid-cols-3 gap-2">
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
                        "flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                        active
                          ? "border-bakery-700 bg-bakery-700 text-white"
                          : "border-border bg-card text-foreground hover:border-bakery-700"
                      )}
                    >
                      <AddressLabelIcon label={option} className="size-4" />
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <IconInput icon={User}
                id="fullName"
                autoComplete="name"
                aria-invalid={formState.errors.fullName ? true : undefined}
                {...register("fullName", { required: "Enter the name for delivery" })}
              />
              <FieldError message={formState.errors.fullName?.message} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <IconInput icon={Mail} id="email" type="email" {...register("email", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <IconInput icon={Phone}
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={formState.errors.phone ? true : undefined}
                  {...register("phone", {
                    required: "Enter a mobile number",
                    validate: (value) =>
                      MOBILE.test(value.replace(/\s+/g, "")) || "Enter a 10-digit mobile number",
                  })}
                />
                <FieldError message={formState.errors.phone?.message} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <IconInput icon={Home}
                id="addressLine1"
                autoComplete="address-line1"
                placeholder="House no., building, street"
                aria-invalid={formState.errors.addressLine1 ? true : undefined}
                {...register("addressLine1", { required: "Enter the house and street" })}
              />
              <FieldError message={formState.errors.addressLine1?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <IconInput icon={Building2} id="addressLine2" {...register("addressLine2")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark</Label>
              <IconInput icon={Landmark}
                id="landmark"
                placeholder="A shop, a turning, anything easy to spot"
                {...register("landmark")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="altPhone">Alternate phone</Label>
                <IconInput icon={PhoneCall} id="altPhone" {...register("altPhone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <IconInput icon={Globe} id="country" {...register("country")} />
              </div>
            </div>
            {/*
              PIN FIRST: typing it fills in the state (see the effect above),
              so it comes before the boxes it can answer.
            */}
            <div className="space-y-2">
              <Label htmlFor="pincode">PIN code</Label>
              <IconInput icon={Hash}
                id="pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                aria-invalid={formState.errors.pincode ? true : undefined}
                {...register("pincode", {
                  required: "Enter the 6-digit PIN code",
                  pattern: { value: /^\d{6}$/, message: "Enter the 6-digit PIN code" },
                })}
              />
              <FieldError message={formState.errors.pincode?.message} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <IconInput icon={Building}
                  id="city"
                  autoComplete="address-level2"
                  aria-invalid={formState.errors.city ? true : undefined}
                  {...register("city", { required: "Enter the city" })}
                />
                <FieldError message={formState.errors.city?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <IconInput icon={MapIcon}
                  id="state"
                  autoComplete="address-level1"
                  aria-invalid={formState.errors.state ? true : undefined}
                  {...register("state", { required: "Enter the state" })}
                />
                <FieldError message={formState.errors.state?.message} />
              </div>
            </div>
            {/*
              The card's closing band, as an order card ends: the default
              choice on the left where "Need help?" sits there, the save on
              the right.
            */}
            <div className={ACCOUNT_CARD_FOOTER}>
              <div className="mr-auto flex items-center gap-2">
                <Checkbox
                  id="isDefault"
                  checked={isDefault}
                  onCheckedChange={(value) => setValue("isDefault", value === true)}
                />
                <Label htmlFor="isDefault" className="cursor-pointer text-sm font-normal">
                  Set as default address
                </Label>
              </div>
              {addresses.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(ACCOUNT_ACTION, "min-w-28 bg-card")}
                  onClick={cancelEdit}
                >
                  <X className="size-4" aria-hidden />
                  Cancel
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="bakery"
                className={cn(ACCOUNT_ACTION, "min-w-32")}
                disabled={formState.isSubmitting}
              >
                {formState.isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {editingId ? "Update address" : "Save address"}
              </Button>
            </div>
          </form>
        </div>
        ) : null}
        <div className={cn("flex flex-wrap items-center justify-between gap-3", showForm && "pt-2")}>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <MapPin className="size-5 text-bakery-700" aria-hidden />
            Saved addresses{addresses.length > 0 ? ` (${addresses.length})` : ""}
          </h2>
          {!showForm ? (
            <Button
              type="button"
              variant="outline"
              className={cn(ACCOUNT_ACTION, "bg-card")}
              onClick={() => setFormOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Add new address
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm md:col-span-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream-100">
                <MapPin className="size-6 text-bakery-700" />
              </div>
              <p className="mt-4 font-heading font-bold text-foreground">No saved addresses</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first delivery address above.
              </p>
            </div>
          ) : (
            addresses.map((address) => (
              /*
                THE SAME READ-BACK AS THE CHECKOUT PICKER (AddressSummary),
                in a plain card with its actions under a hairline. It had a
                header band and a round mark of its own, and next to the
                checkout's rows the same address looked like two different
                ones. `flex-col` with the actions pushed down keeps two cards
                side by side the same height when one address is longer.
              */
              <article
                key={address.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
                  address.isDefault ? "border-bakery-700 ring-1 ring-bakery-700/20" : "border-border"
                )}
              >
                <div className="flex-1 pb-4">
                  <AddressSummary address={address} />
                </div>

                <div className="-mx-2 flex flex-wrap items-center gap-1 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(ACCOUNT_ACTION, "px-2.5")}
                    onClick={() => startEdit(address)}
                    aria-label={`Edit the ${address.label} address`}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(ACCOUNT_ACTION, "px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                    onClick={() => {
                      // One tap deleted it, with no way back.
                      if (!window.confirm(`Remove the ${address.label} address?`)) return;
                      deleteSavedAddress(address.id);
                      toast.success("Address removed");
                      setAddresses(getSavedAddresses());
                    }}
                    aria-label={`Remove the ${address.label} address`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remove
                  </Button>
                  {!address.isDefault ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(ACCOUNT_ACTION, "ml-auto px-2.5 text-bakery-700 hover:bg-cream-100 hover:text-bakery-800")}
                      onClick={() => {
                        setDefaultSavedAddress(address.id);
                        toast.success("Default address updated");
                        setAddresses(getSavedAddresses());
                      }}
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      Set as default
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>

      </div>
    </>
  );
}
