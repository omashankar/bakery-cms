import { StarRating } from "@/components/shared/star-rating";

/**
 * What everyone who reviewed this product actually said, as one block.
 *
 * The page carried a single average and a count, and nothing between them: a
 * 4.2 made of forty fives and ten ones reads exactly like a 4.2 made of fifty
 * fours, and the customer deciding whether to buy is the one who needs to know
 * the difference.
 *
 * Every number here is counted from the SAME rows the list below renders, so
 * the summary and the reviews under it cannot disagree — no stored aggregate is
 * read, and nothing is estimated. With no reviews there is nothing to summarise
 * and this renders nothing at all; the page already has a sentence for that.
 */
export function RatingSummary({ reviews }: { reviews: Array<{ rating: number }> }) {
  if (reviews.length === 0) return null;

  const total = reviews.length;
  const sum = reviews.reduce((running, review) => running + review.rating, 0);
  // One decimal, like every other rating on the storefront.
  const average = Math.round((sum / total) * 10) / 10;

  /** Highest first, which is the order every storefront shows these in. */
  const rows = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((review) => Math.round(review.rating) === stars).length;
    return { stars, count, share: Math.round((count / total) * 100) };
  });

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-cream-50 p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 text-center sm:w-32">
        <p className="font-heading text-4xl font-bold">{average}</p>
        <StarRating rating={average} className="mt-1 justify-center" />
        <p className="mt-1 text-xs text-muted-foreground">
          {total} {total === 1 ? "review" : "reviews"}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row) => (
          <div key={row.stars} className="flex items-center gap-3 text-xs">
            <span className="w-8 shrink-0 text-muted-foreground">{row.stars} ★</span>
            <span
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-cream-100"
              /*
                The bar is decoration; the two numbers beside it are the fact.
                A screen reader that read the track and the fill would announce
                the same figure twice.
              */
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-bakery-700"
                style={{ width: `${row.share}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-muted-foreground">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
