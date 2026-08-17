import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { type FiguresState } from "@/components/shared/panel-loading";

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  change: string;
  icon: LucideIcon;
  href?: string;
  tone?: "bakery" | "gold" | "neutral";
  changeTone?: "positive" | "neutral" | "warning";
  /**
   * Whether this card has a figure to state.
   *
   * Every commerce card starts from `EMPTY_DASHBOARD_COMMERCE_ANALYTICS`, so
   * before the fetch answered the dashboard read "Revenue ₹0.00" and "Active
   * orders 0 — All clear" in confident green, on every cold load, for every
   * shop. Those are two of the most consequential sentences in the admin: one
   * says the shop took no money, the other says nothing is waiting to be made.
   */
  figures?: FiguresState;
}

const toneStyles = {
  bakery: "bg-primary/15 text-primary",
  gold: "bg-gold-500/15 text-gold-600 dark:text-gold-300",
  neutral: "bg-muted text-muted-foreground",
};

const changeToneStyles = {
  positive: "text-green-700 dark:text-green-400",
  neutral: "text-muted-foreground",
  warning: "text-amber-700 dark:text-amber-400",
};

export function DashboardStatCard({
  title,
  value,
  change,
  icon: Icon,
  href,
  tone = "bakery",
  changeTone = "positive",
  figures = "ready",
}: DashboardStatCardProps) {
  const content = (
    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase sm:text-[11px]">
          {title}
        </p>
        {figures === "loading" ? (
          // `relative` anchors the `sr-only` span — see PanelLoading.
          <div role="status" aria-live="polite" className="relative space-y-1.5 py-1">
            <span className="sr-only">Loading {title.toLowerCase()}</span>
            <Skeleton className="h-5 w-20 sm:h-6" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : figures === "unavailable" ? (
          <>
            {/* An em dash, not a zero. A zero is an answer. */}
            <p className="truncate font-heading text-lg font-bold tracking-tight text-muted-foreground sm:text-xl md:text-2xl">
              —
            </p>
            <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
              Figures unavailable
            </p>
          </>
        ) : (
          <>
            <p className="truncate font-heading text-lg font-bold tracking-tight sm:text-xl md:text-2xl">
              {value}
            </p>
            <p
              className={cn(
                "line-clamp-2 text-[11px] leading-snug sm:text-xs",
                changeToneStyles[changeTone],
              )}
            >
              {change}
            </p>
          </>
        )}
      </div>
      <div className={cn("shrink-0 rounded-lg p-1.5 sm:p-2", toneStyles[tone])}>
        <Icon className="size-3.5 sm:size-4" strokeWidth={1.75} />
      </div>
    </div>
  );

  const className = cn(
    "rounded-xl border border-border bg-card p-3 shadow-sm transition-premium sm:p-3.5 md:p-4",
    href
      ? "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : "hover:border-border"
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, "block h-full")}>
        {content}
      </Link>
    );
  }

  return <div className={cn(className, "h-full")}>{content}</div>;
}
