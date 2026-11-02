"use client";

import { CalendarClock, ImageIcon, MessageSquareQuote, StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cartLineChoices } from "@/features/cart/lib/cart";
import { RelativeTime } from "@/components/shared/relative-time";
import { ORDER_STATUS_LABELS } from "@/features/orders/lib/order-status-meta";
import type { KitchenOrderView } from "@/features/orders/lib/staff-order-types";
import { formatCalendarDate } from "@/utils/format";
import { thumbnailImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

import type { SlotUrgency } from "../lib/slot-urgency";

const URGENCY: Record<
  Exclude<SlotUrgency, "later">,
  { variant: "destructive" | "warning" | "secondary"; ring: string }
> = {
  overdue: { variant: "destructive", ring: "border-destructive/40" },
  today: { variant: "warning", ring: "border-amber-400/60" },
  tomorrow: { variant: "secondary", ring: "" },
};

/**
 * One order as the kitchen or a rider sees it: what to make, by when, and the
 * customer's instructions. Never a price — the server does not send one.
 */
export function StaffOrderCard({
  order,
  urgency = null,
  urgencyText = "",
  showStatus = true,
  children,
  footer,
  className,
}: {
  order: KitchenOrderView;
  /** How close the delivery slot is — the thing that decides what to make first. */
  urgency?: SlotUrgency | null;
  /** The badge's words — "3 days late", "Today". */
  urgencyText?: string;
  /** The kitchen's tabs already say the step; a badge on every card repeats it. */
  showStatus?: boolean;
  /** Extra detail between the header and the items — the rider's address. */
  children?: React.ReactNode;
  /** The step buttons. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const slot = order.deliverySlot;
  const flag = urgency && urgency !== "later" ? URGENCY[urgency] : null;
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm",
        flag?.ring,
        className,
      )}
      aria-label={`Order ${order.orderNumber}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground">{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            Placed <RelativeTime date={order.placedAt} />
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {flag && urgencyText ? <Badge variant={flag.variant}>{urgencyText}</Badge> : null}
          {showStatus ? (
            <Badge variant="outline">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
          ) : null}
        </div>
      </header>

      {slot ? (
        <p
          className={cn(
            "flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm font-medium text-foreground",
            urgency === "overdue" && "bg-destructive/10 text-destructive",
          )}
        >
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          <span>
            {formatCalendarDate(slot.date, { weekday: "short", day: "numeric", month: "short" })}
            {slot.timeSlot ? ` · ${slot.timeSlot}` : ""}
            {slot.tierLabel ? ` · ${slot.tierLabel}` : ""}
          </span>
        </p>
      ) : null}

      {children}

      <ul className="space-y-2.5">
        {order.items.map((item) => {
          // The same labelled choices the invoice and the order email print — "Weight: 500 gm".
          const details = cartLineChoices(item);
          const picture = item.photoUrl || item.image;
          return (
            <li key={item.id} className="flex gap-3">
              {picture ? (
                // eslint-disable-next-line @next/next/no-img-element -- a small thumbnail, from wherever the order stored it
                <img
                  src={thumbnailImageUrl(picture, 48)}
                  alt=""
                  className="size-12 shrink-0 rounded-md border border-border object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/70">
                  <ImageIcon className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">
                  <span className="mr-1.5 inline-flex min-w-6 justify-center rounded bg-primary/10 px-1 text-xs font-semibold tabular-nums text-primary">
                    {item.quantity}×
                  </span>
                  {item.name}
                </p>
                {details.length > 0 ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{details.join(" · ")}</p>
                ) : null}
                {item.message ? (
                  <p className="mt-0.5 text-xs text-foreground">
                    <span className="font-medium">Message:</span> “{item.message}”
                  </p>
                ) : null}
                {item.photoUrl ? (
                  <p className="text-xs font-medium text-primary">Photo print — see the picture</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {order.personalisation?.message || order.personalisation?.occasion ? (
        <p className="flex gap-1.5 rounded-md bg-muted/50 p-2 text-sm text-foreground">
          <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {order.personalisation.occasion ? (
              <strong>
                {order.personalisation.occasion}
                {order.personalisation.message ? ". " : ""}
              </strong>
            ) : null}
            {order.personalisation.message}
          </span>
        </p>
      ) : null}

      {order.orderNotes ? (
        <p className="flex gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Customer&apos;s note:</span> {order.orderNotes}
          </span>
        </p>
      ) : null}

      {footer ? (
        <footer className="mt-auto flex gap-2 border-t border-border pt-3">{footer}</footer>
      ) : null}
    </article>
  );
}
