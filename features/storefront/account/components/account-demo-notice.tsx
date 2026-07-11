import { Info } from "lucide-react";

export function AccountDemoNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-cream-100 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-bakery-700" />
      <p>
        UI-only customer authentication. Any valid details will sign you in for
        this demo. Backend integration comes later.
      </p>
    </div>
  );
}
