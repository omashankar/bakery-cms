"use client";

import type { DeliveryLookup } from "@/features/commerce/lib/delivery-location";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * WHAT THE SHOP'S OWN ZONE LIST SAYS ABOUT ONE PIN CODE.
 *
 * Every word here is read out of a matched zone's record. It states nothing of
 * its own: a zone with no name, no minimum days and no charge prints one line
 * saying the code is served, which is all the shop has actually said.
 *
 * "No delivery area covers this PIN code yet" is the careful half, and it is
 * careful on purpose. It is a fact about the zone LIST. "We do not deliver to
 * you" would be a claim about the shop, and a shop that takes that order over
 * the phone — which is most of them — would be calling itself a liar on its
 * own product page.
 *
 * SHARED BECAUSE IT WAS ABOUT TO BE COPIED. This wording lived inside the
 * header's PIN-code popover, and the product page needs to say exactly the same
 * things about exactly the same lookup. A second copy is how two screens come
 * to give a customer two different answers about whether an order can reach
 * them — and the one that is wrong is whichever was edited second.
 */
export function DeliveryAnswer({
  result,
  loading,
  className,
}: {
  result: DeliveryLookup | null;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Checking…</p>;
  }
  if (result === null) return null;

  if (!result.served) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No delivery area covers this PIN code yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium text-foreground">
        {result.zoneName ? `Delivered in ${result.zoneName}` : "We deliver here"}
      </p>
      {result.minDeliveryDays !== null ? (
        <p className="text-muted-foreground">
          {result.minDeliveryDays <= 0
            ? "Same-day delivery available"
            : result.minDeliveryDays === 1
              ? "From the next day"
              : `From ${result.minDeliveryDays} days ahead`}
        </p>
      ) : null}
      {result.charge !== null ? (
        <p className="text-muted-foreground">
          {result.charge > 0 ? `Delivery ${formatCurrency(result.charge)}` : "Free delivery"}
        </p>
      ) : null}
    </div>
  );
}
