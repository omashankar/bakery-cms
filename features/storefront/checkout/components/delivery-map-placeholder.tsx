import { MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryMapPlaceholderProps {
  label: string;
  active?: boolean;
  className?: string;
}

export function DeliveryMapPlaceholder({
  label,
  active = false,
  className,
}: DeliveryMapPlaceholderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-cream-50",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(#e8dfd2 1px, transparent 1px), linear-gradient(90deg, #e8dfd2 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-cream-100/80" />

      <div className="relative flex min-h-[220px] flex-col justify-between p-4 sm:min-h-[260px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {active ? "Live route preview" : "Delivery map"}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
          </div>
          <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            Demo map
          </span>
        </div>

        <div className="relative mx-auto my-4 flex w-full max-w-xs items-center justify-center">
          <div className="absolute left-6 top-1/2 h-px w-[calc(100%-3rem)] -translate-y-1/2 border-t border-dashed border-bakery-400" />
          <div className="relative z-10 flex size-9 items-center justify-center rounded-full border border-border bg-white shadow-sm">
            <Navigation className="size-4 text-bakery-700" />
          </div>
          <div className="relative z-10 ml-auto flex size-10 items-center justify-center rounded-full border-2 border-bakery-700 bg-bakery-700 text-white shadow-sm">
            <MapPin className="size-4" />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {active
            ? "Your delivery partner is en route. Real-time GPS will be available with a live backend."
            : "Map preview will appear when your order is out for delivery."}
        </p>
      </div>
    </div>
  );
}
