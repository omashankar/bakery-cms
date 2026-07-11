import { Check } from "lucide-react";
import type { OrderTimelineStep } from "@/features/storefront/checkout/lib/order-tracking";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

interface OrderStatusTimelineProps {
  steps: OrderTimelineStep[];
  className?: string;
}

export function OrderStatusTimeline({ steps, className }: OrderStatusTimelineProps) {
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.status} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  "absolute top-8 left-4 h-[calc(100%-2rem)] w-px",
                  step.completed ? "bg-bakery-700" : "bg-border"
                )}
              />
            ) : null}
            <div
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                step.current
                  ? "border-bakery-700 bg-bakery-700 text-white"
                  : step.completed
                    ? "border-bakery-700 bg-bakery-700 text-white"
                    : "border-border bg-white text-muted-foreground"
              )}
            >
              {step.completed && !step.current ? <Check className="size-4" /> : index + 1}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={cn("font-medium", step.current && "text-bakery-700")}>
                {step.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              {step.at && step.completed ? (
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(step.at)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
