"use client";

import { useSyncExternalStore } from "react";

import { earliestDeliveryLabel, shopClockNow } from "@/features/orders/lib/delivery-date";
import { getActiveLocale } from "@/features/settings/lib/active-locale";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";

// Read once on mount; a reload picks up the next day. No timer per card.
const subscribe = () => () => {};

function readLabel(): string {
  const commerce = getCommerceSettings();
  return earliestDeliveryLabel(
    commerce.deliveryLeadDays,
    commerce.sameDayCutoff,
    shopClockNow(getActiveLocale().timezone),
  );
}

/**
 * "Earliest Delivery: Today" under a product card's price.
 *
 * In the BROWSER, because it depends on the minute — past the same-day cutoff
 * "Today" becomes "Tomorrow" — and a cached server render would keep saying
 * the old one. The server paints an empty line of the same height, so the
 * words arriving move nothing.
 */
export function EarliestDelivery() {
  const label = useSyncExternalStore(subscribe, readLabel, () => "");

  return (
    <span className="min-h-4 truncate">
      {label ? (
        <>
          {/* Shorter on a phone, where a two-across card is ~170px wide. */}
          <span className="sm:hidden">Delivery</span>
          <span className="hidden sm:inline">Earliest Delivery</span>:{" "}
          <span className="font-medium text-green-700">{label}</span>
        </>
      ) : null}
    </span>
  );
}
