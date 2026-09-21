"use client";

import { Check, X } from "lucide-react";

import type { DeliveryLookup } from "@/features/commerce/lib/delivery-location";
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
export function DeliveryAnswer({
  result,
  pincode,
  loading,
  className,
}: {
  result: DeliveryLookup | null;
  /** Repeated back in the answer, so it is clear which code was checked. */
  pincode?: string;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Checking…</p>;
  }
  if (result === null) return null;

  const code = (pincode ?? "").trim();

  if (!result.served) {
    return (
      <div className={cn("flex min-w-0 items-start gap-2 text-sm", className)}>
        <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <p className="font-medium text-foreground">
          No, we have not covered {code ? code : "this PIN code"} yet
        </p>
      </div>
    );
  }

  /*
    One muted line, not three stacked ones. Beside a field rather than under it
    there is no room for a paragraph, and these are three short facts about the
    same zone — the separator says so more plainly than three sentences do.
  */
  const facts = [
    result.zoneName || null,
    result.minDeliveryDays === null
      ? null
      : result.minDeliveryDays <= 0
        ? "Same-day delivery"
        : result.minDeliveryDays === 1
          ? "From the next day"
          : `From ${result.minDeliveryDays} days ahead`,
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
      </div>
    </div>
  );
}
