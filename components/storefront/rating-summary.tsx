import { OptimizedImage } from "@/components/shared/optimized-image";
import { cn } from "@/lib/utils";

/**
 * The colour of a star rating, the way the shop's reference (Flipkart) paints
 * it: three stars and up green, two amber, one red. Shared by the bars here
 * and the chip on each review, so a "2 ★" reads the same in both places.
 */
export function ratingTone(stars: number): { bar: string; star: string } {
  if (stars >= 3) return { bar: "bg-green-700", star: "text-green-700" };
  if (stars >= 2) return { bar: "bg-amber-500", star: "text-amber-500" };
  return { bar: "bg-red-600", star: "text-red-600" };
}

/** The word the reference puts beside a score: "4.1 ★ Very Good". */
export function ratingWord(rating: number): string {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 4) return "Very Good";
  if (rating >= 3) return "Good";
  if (rating >= 2) return "Fair";
  return "Poor";
}

/**
 * What everyone who reviewed this product actually said, as one block — laid
 * out the way the shop's reference does it: "4.1 ★ Very Good", "based on N
 * ratings" under it, a coloured bar per star, and the photos customers
 * attached.
 *
 * The reference adds "by Verified Buyers". That is left off: only some of these
 * reviewers can be matched to a delivered order, and the line would say it of
 * all of them.
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
export function RatingSummary({
  reviews,
}: {
  reviews: Array<{ rating: number; photoUrls?: string[] }>;
}) {
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

  // Every review's photos in one strip, newest review first — what the
  // reference calls the customers' own pictures of the product.
  const photos = reviews.flatMap((review) => review.photoUrls ?? []).slice(0, 8);

  return (
    <div role="group" aria-label="Ratings summary" className="space-y-4">
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-2xl font-bold">
            {average.toFixed(1)}{" "}
            <span className={cn("text-xl", ratingTone(Math.round(average)).star)}>★</span>
          </span>
          <span className="rounded-md bg-green-50 px-2 py-0.5 text-sm font-medium text-green-800">
            {ratingWord(average)}
          </span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          based on {total} {total === 1 ? "rating" : "ratings"}
        </p>
      </div>

      <div className="max-w-sm space-y-1.5">
        {rows.map((row) => (
          <div key={row.stars} className="flex items-center gap-2 text-xs">
            <span className="w-7 shrink-0 font-medium">{row.stars} ★</span>
            <span
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              /*
                The bar is decoration; the number beside it is the fact. A
                screen reader that read the track and the fill would announce
                the same figure twice.
              */
              aria-hidden
            >
              <span
                className={cn("block h-full rounded-full", ratingTone(row.stars).bar)}
                style={{ width: `${row.share}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-muted-foreground">{row.count}</span>
          </div>
        ))}
      </div>

      {/*
        Only URLs this shop stored itself reach here (see the review list): an
        off-site image on a product page loads for every visitor and can be
        swapped for something else after a moderator approved it.
      */}
      {photos.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
            >
              <OptimizedImage
                src={url}
                alt=""
                width={64}
                height={64}
                className="size-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
