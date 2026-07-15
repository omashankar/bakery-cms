"use client";

import type { RevenuePoint } from "@/features/payments/lib/payment-analytics";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface RevenueChartProps {
  data: RevenuePoint[];
  className?: string;
}

/** Lightweight 7-day revenue bar chart — pure CSS bars, no external library. */
export function RevenueChart({ data, className }: RevenueChartProps) {
  const max = Math.max(1, ...data.map((d) => d.amount));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {data.map((point, i) => {
          const heightPct = Math.round((point.amount / max) * 100);
          const isLast = i === data.length - 1;
          return (
            <div key={point.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] font-semibold text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {point.amount > 0 ? formatCurrency(point.amount) : ""}
              </span>
              <div
                className={cn(
                  "w-full rounded-t-md transition-colors",
                  isLast ? "bg-bakery-700" : "bg-bakery-300 group-hover:bg-bakery-700"
                )}
                style={{ height: `${Math.max(point.amount > 0 ? 6 : 2, heightPct)}%` }}
                title={`${point.label}: ${formatCurrency(point.amount)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 sm:gap-3">
        {data.map((point) => (
          <span key={point.label} className="flex-1 text-center text-[10px] text-muted-foreground">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
