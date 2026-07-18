"use client";

import { MapPin, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
 * The whole card is the control: a customer scanning for "the Delhi one" should
 * be able to hit it anywhere, not hunt for a small radio. The radio itself is
 * still there for keyboard and screen-reader users, just visually quiet.
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
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
          <MapPin className="size-4 text-bakery-700" />
          Delivery address
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onAddNew}>
          <Plus className="size-4" />
          Add new
        </Button>
      </div>

      <ul className="space-y-3">
        {addresses.map((address) => {
          const isSelected = address.id === selectedId;

          return (
            <li key={address.id}>
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition-colors",
                  isSelected
                    ? "border-bakery-700 bg-cream-50"
                    : "border-border bg-white hover:border-bakery-300"
                )}
              >
                <input
                  type="radio"
                  name="deliveryAddress"
                  className="mt-1 size-4 shrink-0 accent-bakery-700"
                  checked={isSelected}
                  onChange={() => onSelect(address)}
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-medium text-bakery-800">
                      {address.label}
                    </span>
                    {/* Nested inside the label, so stop the click selecting. */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onEdit(address);
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-bakery-700 hover:underline focus-visible:ring-2 focus-visible:ring-bakery-700 focus-visible:outline-none"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                      <span className="sr-only"> {address.label} address</span>
                    </button>
                  </div>

                  <p className="font-medium text-foreground">{address.fullName}</p>
                  <p className="text-muted-foreground">{address.phone}</p>
                  <p className="text-muted-foreground">
                    {[address.addressLine1, address.addressLine2, address.city, address.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="text-muted-foreground">Pincode: {address.pincode}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
