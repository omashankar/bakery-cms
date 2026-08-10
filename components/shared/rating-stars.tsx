import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The rating a customer actually gave.
 *
 * Both storefront testimonial sections drew five filled stars for every card,
 * unconditionally — `Array.from({ length: 5 }).map(...)` with the testimonial's
 * own `rating` sitting unread on the object beside it. The admin's list rendered
 * the real figure, so an editor who set a review to three stars saw three in the
 * admin and a five-star endorsement on the live page. The seeds are all rating 5,
 * which is why it stayed invisible until the first edit.
 *
 * Shared so the homepage and the wedding page cannot drift apart again.
 */
export function RatingStars({
  rating,
  className,
  starClassName,
}: {
  rating: number;
  className?: string;
  starClassName?: string;
}) {
  // A stored rating is admin-typed and has been unbounded server-side; clamp
  // rather than render a row of forty stars or a negative-length array.
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${filled} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            "size-4",
            index < filled ? "fill-current" : "fill-none opacity-30",
            starClassName,
          )}
        />
      ))}
    </div>
  );
}
