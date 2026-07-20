import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number;
  /** `sm` = compact, for product cards; `default` = large, for the product page. */
  size?: "sm" | "default";
  className?: string;
}

export function PriceDisplay({
  price,
  compareAtPrice,
  size = "default",
  className,
}: PriceDisplayProps) {
  const hasDiscount = compareAtPrice != null && compareAtPrice > price;
  const isSm = size === "sm";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "font-heading font-bold text-bakery-700",
          isSm ? "text-lg" : "text-2xl sm:text-3xl"
        )}
      >
        {formatCurrency(price)}
      </span>
      {hasDiscount ? (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through",
              isSm ? "text-sm" : "text-lg"
            )}
          >
            {formatCurrency(compareAtPrice)}
          </span>
          <span
            className={cn(
              "rounded-md bg-gold-50 font-semibold text-gold-800",
              isSm ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
            )}
          >
            {Math.round(((compareAtPrice - price) / compareAtPrice) * 100)}% OFF
          </span>
        </>
      ) : null}
    </div>
  );
}
