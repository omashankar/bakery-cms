import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number;
  className?: string;
}

export function PriceDisplay({ price, compareAtPrice, className }: PriceDisplayProps) {
  const hasDiscount = compareAtPrice != null && compareAtPrice > price;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span className="font-heading text-2xl font-bold text-bakery-700 sm:text-3xl">
        {formatCurrency(price)}
      </span>
      {hasDiscount ? (
        <>
          <span className="text-lg text-muted-foreground line-through">
            {formatCurrency(compareAtPrice)}
          </span>
          <span className="rounded-md bg-gold-50 px-2 py-0.5 text-xs font-semibold text-gold-800">
            {Math.round(((compareAtPrice - price) / compareAtPrice) * 100)}% OFF
          </span>
        </>
      ) : null}
    </div>
  );
}
