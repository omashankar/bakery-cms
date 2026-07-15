import { BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  { icon: Lock, label: "256-bit SSL", sub: "Encrypted" },
  { icon: ShieldCheck, label: "Secure Checkout", sub: "Verified" },
  { icon: BadgeCheck, label: "PCI-DSS Ready", sub: "Compliant" },
] as const;

interface SecurityBadgesProps {
  className?: string;
  /** "row" (default) for a compact strip, "grid" for equal cards. */
  variant?: "row" | "grid";
}

/** Trust badges shown near the payment step. Placeholders — no live attestation. */
export function SecurityBadges({ className, variant = "row" }: SecurityBadgesProps) {
  return (
    <div
      className={cn(
        variant === "grid"
          ? "grid grid-cols-3 gap-2"
          : "flex flex-wrap items-center gap-2",
        className
      )}
    >
      {BADGES.map((badge) => (
        <div
          key={badge.label}
          className="flex items-center gap-2 rounded-lg border border-border bg-cream-50 px-3 py-2"
        >
          <badge.icon className="size-4 shrink-0 text-bakery-700" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-foreground">{badge.label}</p>
            <p className="truncate text-[10px] text-muted-foreground">{badge.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
