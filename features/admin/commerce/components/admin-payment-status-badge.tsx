import type { PaymentStatus } from "@/features/orders/lib/orders";
import { Badge } from "@/components/ui/badge";

const labels: Record<PaymentStatus, string> = {
  cod: "COD",
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

const variants: Record<
  PaymentStatus,
  "success" | "warning" | "destructive" | "secondary"
> = {
  cod: "secondary",
  paid: "success",
  pending: "warning",
  failed: "destructive",
  refunded: "secondary",
};

export function AdminPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
