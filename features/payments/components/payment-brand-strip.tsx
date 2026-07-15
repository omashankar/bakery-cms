import { cn } from "@/lib/utils";

interface PaymentBrandStripProps {
  brands: string[];
  className?: string;
}

/**
 * Small brand chips (UPI, Visa, Mastercard, RuPay …). Text-based on-brand pills —
 * no external brand-logo assets, so nothing breaks and it stays theme-consistent.
 */
export function PaymentBrandStrip({ brands, className }: PaymentBrandStripProps) {
  if (!brands.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {brands.map((brand) => (
        <span
          key={brand}
          className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
        >
          {brand}
        </span>
      ))}
    </div>
  );
}
