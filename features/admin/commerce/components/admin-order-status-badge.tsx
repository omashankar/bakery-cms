import type { OrderStatus } from "@/features/orders/lib/orders";
import { formatOrderStatus } from "@/features/orders/lib/order-status-meta";
import { Badge } from "@/components/ui/badge";

const variants: Record<
  OrderStatus,
  "accent" | "warning" | "bakery" | "success" | "destructive" | "secondary" | "outline"
> = {
  pending: "outline",
  confirmed: "accent",
  preparing: "warning",
  ready: "secondary",
  out_for_delivery: "bakery",
  delivered: "success",
  cancelled: "destructive",
  refunded: "secondary",
};

export function AdminOrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={variants[status]}>{formatOrderStatus(status)}</Badge>;
}
