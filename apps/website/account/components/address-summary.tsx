import { Phone } from "lucide-react";

import { AddressLabelIcon } from "@/apps/website/account/components/address-label-icon";
import type { SavedAddress } from "@/apps/website/account/lib/customer-addresses";
import { formatAddress } from "@/features/orders/lib/address-format";

/**
 * ONE SAVED ADDRESS, READ BACK: the name with its label and "Default" on the
 * first line, the address under it, the phone last.
 *
 * Shared by the account's address book and the checkout picker, so an address
 * looks the same in both. Both had grown their own card — a header band, a
 * round mark, the address in a column of its own — and side by side they read
 * as two different addresses, and neither read cleanly.
 *
 * Spans only, so it can sit inside the checkout's <label>: a label may hold
 * only phrasing content.
 */
export function AddressSummary({ address }: { address: SavedAddress }) {
  return (
    <span className="block min-w-0 text-sm">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground">{address.fullName}</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-cream-100 px-2 py-0.5 text-xs font-medium text-bakery-800">
          <AddressLabelIcon label={address.label} className="size-3" />
          {address.label}
        </span>
        {address.isDefault ? (
          <span className="rounded-md border border-bakery-200 px-2 py-0.5 text-xs text-muted-foreground">
            Default
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block leading-relaxed text-muted-foreground">
        {formatAddress(address)}
      </span>
      <span className="mt-1 flex items-center gap-1.5 text-muted-foreground">
        <Phone className="size-3.5 shrink-0" aria-hidden />
        {address.phone}
      </span>
    </span>
  );
}
