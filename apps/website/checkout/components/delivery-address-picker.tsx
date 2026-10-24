"use client";

import { MapPin, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddressSummary } from "@/apps/website/account/components/address-summary";
import { ACCOUNT_ACTION } from "@/apps/website/account/lib/account-buttons";
import type { SavedAddress } from "@/apps/website/account/lib/customer-addresses";
import { cn } from "@/lib/utils";

interface DeliveryAddressPickerProps {
  addresses: SavedAddress[];
  selectedId: string | null;
  onSelect: (address: SavedAddress) => void;
  onEdit: (address: SavedAddress) => void;
  onAddNew: () => void;
}

/**
 * Saved destinations, picked rather than retyped.
 *
 * The whole row is the control: a customer scanning for "the Delhi one" should
 * be able to hit it anywhere, not hunt for a small radio. The radio itself is
 * still there for keyboard and screen-reader users.
 *
 * ONE QUIET ROW PER ADDRESS, full width, the way a checkout lists them: the
 * name and its label on the first line, the address under it, the phone last.
 * It was briefly an account-style card with a header band, two across — a card
 * inside the step's own card, a second round mark beside the radio, and long
 * addresses broken over three lines in half-width columns. It read as clutter
 * at the one moment the customer only needs to see which address is ticked.
 *
 * What it says is `AddressSummary`, the same read-back the account's address
 * book uses, so the address a customer saved there looks the same here.
 */
export function DeliveryAddressPicker({
  addresses,
  selectedId,
  onSelect,
  onEdit,
  onAddNew,
}: DeliveryAddressPickerProps) {
  if (addresses.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
          <MapPin className="size-4 text-bakery-700" aria-hidden />
          Saved addresses
        </h3>
        <Button
          type="button"
          variant="outline"
          className={cn(ACCOUNT_ACTION, "bg-card")}
          onClick={onAddNew}
        >
          <Plus className="size-4" aria-hidden />
          Add new
        </Button>
      </div>

      <ul className="space-y-3">
        {addresses.map((address) => {
          const isSelected = address.id === selectedId;

          return (
            <li key={address.id} className="relative">
              <label
                className={cn(
                  // Room for Edit: its pencil alone on a phone, the word too from sm.
                  "flex cursor-pointer gap-3 rounded-xl border p-4 pr-12 text-sm transition-colors sm:pr-20",
                  isSelected
                    ? "border-bakery-700 bg-cream-50 ring-1 ring-bakery-700/20"
                    : "border-border bg-card hover:border-bakery-300"
                )}
              >
                <input
                  type="radio"
                  name="deliveryAddress"
                  className="mt-0.5 size-4 shrink-0 accent-bakery-700"
                  checked={isSelected}
                  onChange={() => onSelect(address)}
                />

                <span className="min-w-0 flex-1">
                  <AddressSummary address={address} />
                </span>
              </label>

              {/* Sibling of the label (not nested inside it) — valid HTML and its
                  own tab stop, so no preventDefault juggling is needed. */}
              <button
                type="button"
                onClick={() => onEdit(address)}
                aria-label={`Edit the ${address.label} address`}
                className="absolute top-3 right-3 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-bakery-700 transition-colors hover:bg-cream-100 focus-visible:ring-2 focus-visible:ring-bakery-700 focus-visible:outline-none sm:px-2.5"
              >
                <Pencil className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
