import type { RefundEvent } from "@/types/refund";
import { formatRefundStatus } from "@/apps/admin/commerce/lib/refund-utils";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

interface RefundTimelineProps {
  events: RefundEvent[];
  className?: string;
}

export function RefundTimeline({ events, className }: RefundTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No refund activity yet.</p>;
  }

  return (
    <ol className={cn("space-y-4", className)}>
      {events.map((event, index) => (
        <li key={`${event.at}-${event.status}-${index}`} className="relative pl-6">
          {index < events.length - 1 ? (
            <span className="absolute top-2 left-[7px] h-full w-px bg-border" />
          ) : null}
          <span
            className={cn(
              "absolute top-1.5 left-0 size-3.5 rounded-full border-2 border-white",
              event.status === "completed" && "bg-green-600",
              event.status === "processing" && "bg-blue-600",
              event.status === "requested" && "bg-amber-500",
              event.status === "rejected" && "bg-red-600"
            )}
          />
          <div>
            <p className="text-sm font-medium">{formatRefundStatus(event.status)}</p>
            <p className="text-xs text-muted-foreground">{formatDate(event.at)}</p>
            {event.note ? (
              <p className="mt-1 text-sm text-muted-foreground">{event.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
