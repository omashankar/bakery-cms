import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/types/cake";
import { cn } from "@/lib/utils";
import {
  formatStockStatusLabel,
  getStockStatusVariant,
} from "@/features/admin/commerce/lib/inventory-utils";

interface StockStatusBadgeProps {
  status: StockStatus;
  unlimited?: boolean;
  quantity?: number;
  showQuantity?: boolean;
  className?: string;
}

export function StockStatusBadge({
  status,
  unlimited = false,
  quantity,
  showQuantity = false,
  className,
}: StockStatusBadgeProps) {
  if (unlimited) {
    return (
      <Badge variant="secondary" className={cn("font-medium", className)}>
        Unlimited
      </Badge>
    );
  }

  return (
    <Badge variant={getStockStatusVariant(status)} className={cn("font-medium", className)}>
      {formatStockStatusLabel(status)}
      {showQuantity && typeof quantity === "number" ? ` · ${quantity}` : ""}
    </Badge>
  );
}

interface StockAlertBadgeProps {
  count: number;
  className?: string;
}

export function StockAlertBadge({ count, className }: StockAlertBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
