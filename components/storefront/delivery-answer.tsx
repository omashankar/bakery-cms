"use client";

import { useState } from "react";
import { Check, MapPin, X } from "lucide-react";

import { ExactAddressCheck } from "@/components/storefront/exact-address-check";
import { soonestDeliveryDays, soonestDeliveryText, type DeliveryLookup } from "@/features/commerce/lib/delivery-location";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * WHAT THE SHOP'S OWN ZONE LIST SAYS ABOUT ONE PIN CODE.
 *
 * A yes or a no first, with the code repeated back so there is no doubt which
 * one was answered — a customer who typed 324001, read "yes", and had actually
 * mistyped 324010 finds that out at checkout otherwise. Then the facts, each
 * read off the matched zone's record and each shown only when that zone
 * actually carries it. A zone with no name, no minimum days and no charge
 * prints the yes and nothing else, which is all the shop has said.
 *
 * "WE HAVE NOT COVERED THIS YET" IS THE CAREFUL HALF. It is a statement about
 * the zone LIST — a thing the shop controls and can change this afternoon.
 * "We do not deliver to you" would be a claim about the shop, and a shop that
 * would happily take that order over the phone, which is most of them, would be
 * calling itself a liar on its own product page. The word "yet" is doing real
 * work there and is not filler.
 *
 * SHARED, because the header's popover and the product page's row ask exactly
 * the same question of exactly the same list. A second copy of this wording is
 * how two screens come to tell one customer two different things about whether
 * an order can reach them — and the wrong one is whichever was edited second.
 * It renders a plain block and takes no position on where it sits: the product
 * page puts it beside the field, the header's popover under it.
 */
/** "Talwandi, Kota" — the first area and the district, from India Post. */
function placeLine(place: DeliveryLookup["place"]): string {
  if (!place) return "";
  const district = place.districts[0] ?? "";
  const named = place.areas.filter((name) => name.toLowerCase() !== district.toLowerCase());
  // A neighbourhood a customer would say ("Vigyan Nagar"), not a counter's
  // abbreviation ("P.I.P.").
  const area = named.find((name) => !name.includes(".")) ?? named[0] ?? "";
  return [area, district].filter(Boolean).join(", ");
}

export function DeliveryAnswer({
  result,
  pincode,
  loading,
  exactCheck = true,
  exactHint = "Your exact address is checked on the map at checkout.",
  className,
}: {
  result: DeliveryLookup | null;
  /** Repeated back in the answer, so it is clear which code was checked. */
  pincode?: string;
  loading?: boolean;
  /**
   * Offer "check your exact address" where a PIN cannot answer. Off in the
   * header, which checks the PIN alone (owner, 2026-10-27).
   */
  exactCheck?: boolean;
  /** Said instead, where the exact check is offered some other way. */
  exactHint?: string;
  className?: string;
}) {
  if (loading) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Checking…</p>;
  }
  if (result === null) return null;

  const code = (pincode ?? "").trim();
  const where = placeLine(result.place);

  if (result.unknownPincode) {
    return (
      <div className={cn("flex min-w-0 items-start gap-2 text-sm", className)}>
        <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {code ? code : "This PIN code"} is not a PIN code we can find
          </p>
          <p className="text-muted-foreground">Please check the digits and try again.</p>
        </div>
      </div>
    );
  }

  // Delivered by areas drawn on the map: a PIN cannot say, the door can —
  // so the customer checks it here, not first at checkout.
  if (result.needsPin) {
    return (
      <div className={cn("min-w-0 space-y-2 text-sm", className)}>
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-bakery-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">We deliver to parts of {code || "this PIN"} — check your exact address</p>
            {/* The place, not the shop's zone names — those are the owner's own words. */}
            {where ? <p className="text-muted-foreground">{where}</p> : null}
          </div>
        </div>
        {exactCheck ? (
          <ExactAddressCheck pincode={code} />
        ) : (
          <p className="text-xs text-muted-foreground">{exactHint}</p>
        )}
      </div>
    );
  }

  if (!result.served) {
    return (
      <div className={cn("flex min-w-0 items-start gap-2 text-sm", className)}>
        <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            No, we have not covered {code ? code : "this PIN code"} yet
          </p>
          {where ? <p className="text-muted-foreground">{where}</p> : null}
        </div>
      </div>
    );
  }

  /*
    One muted line, not three stacked ones. Beside a field rather than under it
    there is no room for a paragraph, and these are three short facts about the
    same zone — the separator says so more plainly than three sentences do.
  */
  const facts = [
    // The real place first — it is what tells a customer the right code was
    // checked. Not the zone's name: that is the owner's own word ("₹40
    // areas", "sangod"), and means nothing to the person ordering.
    where || null,
    // The zone's days, the shop's lead time and today's cutoff — as checkout's date picker allows.
    soonestDeliveryText(soonestDeliveryDays(result.minDeliveryDays)),
    result.charge === null
      ? null
      : result.charge > 0
        ? `Delivery ${formatCurrency(result.charge)}`
        : "Free delivery",
  ].filter(Boolean);

  return (
    <div className={cn("flex min-w-0 items-start gap-2 text-sm", className)}>
      <Check className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          Yes, we have delivery at {code ? code : "this PIN code"}
        </p>
        {facts.length > 0 ? (
          <p className="text-muted-foreground">{facts.join(" · ")}</p>
        ) : null}
        {/* A drawn area inside this district may be cheaper at one door. */}
        {result.priceMayVary && exactCheck ? <CheaperNearby pincode={code} /> : null}
      </div>
    </div>
  );
}

/** "Some areas cost less — check your exact address", opened on request. */
function CheaperNearby({ pincode }: { pincode: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <ExactAddressCheck pincode={pincode} className="mt-2" />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-1 text-xs font-medium text-bakery-700 underline underline-offset-2"
    >
      Some areas have a lower delivery charge — check your exact address
    </button>
  );
}
