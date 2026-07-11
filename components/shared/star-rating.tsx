import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  max = 5,
  size = "sm",
  showValue = false,
  className,
}: StarRatingProps) {
  const iconClass = size === "md" ? "size-4" : "size-3.5";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: max }).map((_, index) => {
        const filled = index < Math.round(rating);
        return (
          <Star
            key={index}
            className={cn(
              iconClass,
              filled ? "fill-gold-300 text-gold-300" : "text-border"
            )}
          />
        );
      })}
      {showValue ? (
        <span className="text-sm text-muted-foreground">{rating.toFixed(1)}</span>
      ) : null}
    </div>
  );
}
