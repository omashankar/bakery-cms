import { Phone, Star, Truck } from "lucide-react";
import type { DeliveryPartnerInfo } from "@/features/storefront/checkout/lib/delivery-tracking";
import { cn } from "@/lib/utils";

interface DeliveryPartnerCardProps {
  partner: DeliveryPartnerInfo;
  delivered?: boolean;
  className?: string;
}

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
          <p className="text-sm text-muted-foreground">{partner.vehicle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Star className="size-3.5 fill-current" />
              {partner.rating.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Phone className="size-3.5" />
              {partner.phone}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Partner ID {partner.partnerId} · Demo assignment for frontend preview
          </p>
        </div>
      </div>
    </div>
  );
}
