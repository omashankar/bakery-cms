"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Search, XCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatZoneDeliveryTime,
  isFullPincode,
  normalizePincode,
} from "@/features/commerce/lib/delivery-zone-utils";
import { describeMatch, explainPincode } from "@/features/commerce/lib/delivery-zone-validation";
import { fetchPincodePlace } from "@/features/commerce/lib/pincode-api";
import type { DeliveryZone, PincodePlace } from "@/types/delivery";
import type { CommerceSettings } from "@/types/settings";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * WHERE DOES THIS PIN GO — asked of the whole zone map at once.
 *
 * With zones covering India, states, cities and PIN prefixes, with leave-out
 * lists on top, the only way an owner could learn which zone an address landed
 * in was to place an order to it. This answers from the same ranking checkout
 * prices from and the same switches checkout obeys, and lists the zones that
 * also cover the PIN but lose, so "why is Kota charged ₹149?" has an answer on
 * this screen.
 */
/** "2025-10-03" → "3 Oct 2025", the same in every timezone. */
function formatDirectoryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${month} ${y}`;
}

export function ZonePinChecker({
  zones,
  commerce,
  directory = null,
  className,
}: {
  /** India Post's list this answers from: its date and size. */
  directory?: { updated: string; pins: number } | null;
  zones: DeliveryZone[];
  commerce: Pick<
    CommerceSettings,
    "useZoneBasedDelivery" | "deliverOutsideZones" | "zoneFallbackDeliveryFee" | "deliveryFee"
  >;
  className?: string;
}) {
  const [entered, setEntered] = useState("");
  // India Post's answer for the code in the box, kept with the code it is for.
  const [asked, setAsked] = useState<{ code: string; place: PincodePlace | null } | null>(null);
  const full = isFullPincode(entered) ? entered : "";
  useEffect(() => {
    if (!full) return;
    let alive = true;
    void fetchPincodePlace(full).then((answer) => {
      if (alive && answer) setAsked({ code: full, place: answer.place });
    });
    return () => {
      alive = false;
    };
  }, [full]);
  // Undefined until it arrives (or if it cannot): the digits answer meanwhile.
  const place = asked && asked.code === full ? asked.place : undefined;
  const verdict = explainPincode(zones, entered, commerce, formatCurrency, place);

  return (
    <section className={cn("rounded-xl border border-border bg-card p-3 sm:p-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Label htmlFor="zone-map-pin" className="shrink-0 text-sm font-medium">
          Check a PIN code
        </Label>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="zone-map-pin"
            className="h-10 pl-9"
            inputMode="numeric"
            autoComplete="off"
            value={entered}
            onChange={(event) => setEntered(normalizePincode(event.target.value))}
            placeholder="324005"
          />
        </div>
        {!verdict ? (
          <p className="text-xs text-muted-foreground">
            Type a 6-digit PIN to see which zone delivers it and what it costs.
          </p>
        ) : null}
      </div>
      {directory ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Places from India Post&apos;s PIN directory — {directory.pins.toLocaleString("en-IN")} PIN
          codes, updated {formatDirectoryDate(directory.updated)}.
        </p>
      ) : null}

      {verdict ? (
        <div className="mt-3 flex items-start gap-2 text-sm" aria-live="polite">
          {verdict.delivered ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground">
              {verdict.pincode}
              {verdict.place
                ? ` · ${verdict.place.districts.join(" / ")}, ${verdict.place.state}`
                : verdict.place === null
                  ? " · not a real PIN code"
                  : verdict.state
                    ? ` · ${verdict.state}`
                    : " · no Indian state starts with these digits"}
            </p>
            {verdict.place?.areas.length ? (
              <p className="text-muted-foreground">Areas: {verdict.place.areas.join(", ")}</p>
            ) : null}
            <p className="text-foreground">{verdict.outcome}</p>
            {verdict.winner ? (
              <p className="text-muted-foreground">
                Matched by {describeMatch(verdict.winner)} · {formatZoneDeliveryTime(verdict.winner.zone)}
              </p>
            ) : null}
            {verdict.alsoCovered.length > 0 ? (
              <p className="text-muted-foreground">
                Also covered by{" "}
                {verdict.alsoCovered
                  .map((match) => `"${match.zone.name}" (${describeMatch(match)})`)
                  .join(", ")}{" "}
                — the narrower zone wins.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
