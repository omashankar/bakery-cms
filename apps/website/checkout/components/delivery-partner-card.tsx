import { Phone, Truck } from "lucide-react";
import type { DeliveryPartner } from "@/features/orders/lib/orders";
import { cn } from "@/lib/utils";

interface DeliveryPartnerCardProps {
  partner: DeliveryPartner;
  delivered?: boolean;
  className?: string;
}

/**
 * Who is bringing the order, as the BAKERY entered them.
 *
 * This used to show an invented courier on every order — a name, a phone number
 * a customer could ring, and a star rating — chosen by hashing the order id
 * against three hardcoded people. The only thing marking it as fiction was
 * "Demo assignment for frontend preview" in small grey text under the phone
 * number, which is not a disclaimer anyone reads before dialling.
 *
 * The rating and the partner id are gone rather than made real: a rating for a
 * delivery that has not happened describes nothing, and a shop with no rider
 * management has a name and a phone.
 */
export function DeliveryPartnerCard({
  partner,
  delivered = false,
  className,
}: DeliveryPartnerCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-white p-5 shadow-sm", className)}>
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cream-100 text-bakery-700">
          <Truck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {delivered ? "Delivered by" : "Delivery partner"}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold">{partner.name}</p>
          {partner.vehicle ? (
            <p className="text-sm text-muted-foreground">{partner.vehicle}</p>
          ) : null}
          {partner.phone ? (
            <a
              href={`tel:${partner.phone.replace(/\s+/g, "")}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-bakery-700 hover:underline"
            >
              <Phone className="size-3.5" />
              {partner.phone}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
