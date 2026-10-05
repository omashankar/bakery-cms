import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number;
  /**
   * `sm` = compact, for product cards; `default` = large, in a list or a
   * summary; `lg` = the product page, where the price is the thing the
   * customer opened the page to read and should be the largest figure on it.
   */
  size?: "sm" | "default" | "lg";
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
  const isLg = size === "lg";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "font-heading font-bold text-bakery-700",
          isSm ? "text-lg" : isLg ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
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
          {/*
            GREEN, which is what a saving is in this repo already: the tax
            breakdown paints a discount line `text-green-700`, and the shared
            Badge has a `success` variant in the same family. This pill was
            the odd one out in gold, which on a cream card reads as decoration
            rather than as money off.
          */}
          <span
            className={cn(
              "rounded-md bg-green-100 font-semibold text-green-800",
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
