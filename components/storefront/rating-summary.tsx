import { OptimizedImage } from "@/components/shared/optimized-image";
import { cn } from "@/lib/utils";

/**
 * The colour of a star rating, the way the shop's reference (Flipkart) paints
 * it: three stars and up green, two amber, one red. Shared by the bars here
 * and the chip on each review, so a "2 ★" reads the same in both places.
 */
export function ratingTone(stars: number): string {
  if (stars >= 3) return "bg-green-700";
  if (stars >= 2) return "bg-amber-500";
  return "bg-red-600";
}

/**
 * What everyone who reviewed this product actually said, as one block — laid
 * out the way the shop's reference does it: the average large with "N Ratings
 * & N Reviews" beneath it, a coloured bar per star beside it, and the photos
 * customers attached underneath both.
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
      <div className="flex items-center gap-5 sm:gap-10">
        <div className="shrink-0 text-center">
          <p className="font-heading text-3xl font-bold">
            {average.toFixed(1)} <span className="text-2xl">★</span>
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {total} {total === 1 ? "Rating" : "Ratings"} &amp;{" "}
            <br />
            {total} {total === 1 ? "Review" : "Reviews"}
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5 border-l border-border pl-5 sm:max-w-sm sm:pl-10">
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
                  className={cn("block h-full rounded-full", ratingTone(row.stars))}
                  style={{ width: `${row.share}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-muted-foreground">{row.count}</span>
            </div>
          ))}
        </div>
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
