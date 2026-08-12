import { Skeleton } from "@/components/ui/skeleton";

/**
 * Whether a figure surface has anything to state, and if not, why.
 *
 * Three states, because there are three situations and only one of them
 * entitles a card to print a number:
 *
 *  - `loading`   — the request is in flight. Say nothing; show the shape.
 *  - `unavailable` — it has failed and nothing was ever read. Still say
 *    nothing, but stop pretending to be busy. This one was the gap: a failed
 *    cold load left every zero on screen and disclaimed them in a caption
 *    below, so "Active orders 0 — All clear" sat in confident green under
 *    "Figures unavailable — the server did not answer".
 *  - `ready`     — there are real figures. A zero here is the shop's zero.
 *
 * Once anything HAS loaded the state stays `ready` through a later failure:
 * those are true numbers from a moment ago, and blanking them to report a
 * transient error trades information for noise.
 */
export type FiguresState = "loading" | "unavailable" | "ready";

/** What a panel shows when its figures failed and there is nothing to fall back on. */
export function PanelUnavailable({ className }: { className?: string }) {
  return (
    <p
      className={
        className ??
        "flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground"
      }
    >
      Figures unavailable
    </p>
  );
}

/**
 * What a dashboard panel shows while its figures are still being fetched.
 *
 * The sibling of [ListLoading] for the small analytics cards, and it exists for
 * the same reason. "No orders yet", "No payment data in this period." and "No
 * sales yet" are claims about the shop's takings, and a panel whose request has
 * not answered has not earned one — each of these reads its empty branch off
 * `EMPTY_DASHBOARD_COMMERCE_ANALYTICS`, so on every cold load a busy bakery was
 * told it had sold nothing.
 *
 * Bars rather than a spinner: these panels are rows of labelled figures, and a
 * skeleton of that shape does not shift the card when the numbers land.
 */
export function PanelLoading({
  rows = 3,
  label = "Loading",
}: {
  rows?: number;
  /** Announced to screen readers, which cannot see a shimmer. */
  label?: string;
}) {
  return (
    <div className="flex-1 space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
