import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a list shows while it is still being fetched.
 *
 * NOT an empty state. "No products found", "No customers yet" and their
 * siblings are claims about the shop's records, and a list whose request has
 * not answered yet is not entitled to make one — on a cold load it is a claim
 * that is wrong for every shop that has any data at all. The admin's own orders
 * list already said so: "Saying 'No orders found' before the server has
 * answered would be a guess, and a wrong one on every cold load in a shop that
 * has orders." Its three sibling lists rendered the empty state regardless.
 *
 * Rows rather than a spinner, because these all sit in a table card: a skeleton
 * of the shape that is coming does not move the page around when it arrives.
 */
export function ListLoading({
  rows = 5,
  label = "Loading",
}: {
  rows?: number;
  /** Announced to screen readers, which cannot see a shimmer. */
  label?: string;
}) {
  return (
    // `relative` anchors the absolutely-positioned `sr-only` span below — see
    // PanelLoading for what it costs when the containing block is <body>.
    <div className="relative divide-y divide-border" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="hidden h-3 w-16 sm:block" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
