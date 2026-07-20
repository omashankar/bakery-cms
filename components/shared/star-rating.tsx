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
        const fillLevel = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} className={cn("relative inline-block", iconClass)}>
            <Star className={cn(iconClass, "text-border")} />
            {fillLevel > 0 ? (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillLevel * 100}%` }}
              >
                <Star className={cn(iconClass, "fill-gold-300 text-gold-300")} />
              </span>
            ) : null}
          </span>
        );
      })}
      {showValue ? (
        <span className="text-sm text-muted-foreground">{rating.toFixed(1)}</span>
      ) : null}
    </div>
  );
}
