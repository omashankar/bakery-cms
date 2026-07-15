import type { MethodSlice } from "@/features/payments/lib/payment-analytics";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface PaymentMethodBreakdownProps {
  methods: MethodSlice[];
  className?: string;
}

/** Horizontal share bars per payment method. */
export function PaymentMethodBreakdown({ methods, className }: PaymentMethodBreakdownProps) {
  if (methods.length === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        No collected payments yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {methods.map((method, i) => (
        <div key={method.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{method.label}</span>
            <span className="text-muted-foreground">
              {method.count} · {formatCurrency(method.amount)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-100">
              <div
                className={cn("h-full rounded-full", i === 0 ? "bg-bakery-700" : "bg-gold")}
                style={{ width: `${Math.max(4, method.pct)}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-semibold text-foreground">
              {method.pct}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
