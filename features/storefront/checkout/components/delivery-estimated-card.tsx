import { CalendarClock, MapPin, Truck } from "lucide-react";
import type { DeliveryTrackingSnapshot } from "@/features/orders/lib/delivery-tracking";
import { cn } from "@/lib/utils";

interface DeliveryEstimatedCardProps {
  snapshot: DeliveryTrackingSnapshot;
  orderNumber: string;
  className?: string;
}

export function DeliveryEstimatedCard({
  snapshot,
  orderNumber,
  className,
}: DeliveryEstimatedCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8",
        className
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Order {orderNumber}
          </p>
          <div>
            <h2 className="font-heading text-2xl font-semibold text-bakery-900 sm:text-3xl">
              {snapshot.etaHeadline}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {snapshot.etaDetail}
            </p>
          </div>
          <p className="text-sm text-foreground">{snapshot.statusMessage}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[280px]">
          <div className="rounded-xl border border-border bg-cream-50 px-4 py-3">
            <div className="flex items-center gap-2 text-bakery-700">
              <CalendarClock className="size-4" />
              <span className="text-xs font-medium tracking-wide uppercase">Time window</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{snapshot.etaWindow}</p>
          </div>
          <div className="rounded-xl border border-border bg-cream-50 px-4 py-3">
            <div className="flex items-center gap-2 text-bakery-700">
              <MapPin className="size-4" />
              <span className="text-xs font-medium tracking-wide uppercase">Delivering to</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{snapshot.mapLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Truck className="size-3.5" />
            Delivery progress
          </span>
          <span>{snapshot.progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-cream-100">
          <div
            className="h-full rounded-full bg-bakery-700 transition-all duration-500"
            style={{ width: `${snapshot.progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
