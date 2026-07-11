import { Info } from "lucide-react";

export function PaymentDemoNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-cream-100 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-bakery-700" />
      <p>
        UI-only payment screen. No real money is charged. Use demo details to continue
        checkout.
      </p>
    </div>
  );
}
