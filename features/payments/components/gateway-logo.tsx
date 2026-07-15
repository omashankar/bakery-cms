import { cn } from "@/lib/utils";

interface GatewayLogoProps {
  mark: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "size-8 text-xs rounded-lg",
  md: "size-11 text-sm rounded-xl",
  lg: "size-14 text-base rounded-2xl",
} as const;

/**
 * Brand-neutral monogram tile for a gateway. Text-based (no external logo assets)
 * so it stays theme-consistent and never breaks.
 */
export function GatewayLogo({ mark, size = "md", className }: GatewayLogoProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-cream-100 font-heading font-bold text-bakery-700",
        SIZES[size],
        className
      )}
      aria-hidden
    >
      {mark}
    </span>
  );
}
