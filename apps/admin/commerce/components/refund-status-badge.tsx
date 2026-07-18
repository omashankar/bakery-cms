import type { RefundStatus } from "@/types/refund";
import { Badge } from "@/components/ui/badge";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { cn } from "@/lib/utils";
import { formatRefundStatus } from "../lib/refund-utils";

const toneClasses: Record<RefundStatus | "cancelled", string> = {
  requested: adminShell.toneWarning,
  processing: adminShell.toneInfo,
  completed: adminShell.tonePositive,
  rejected: adminShell.toneDestructive,
  cancelled: "border-border bg-muted text-foreground",
};

interface RefundStatusBadgeProps {
  status: RefundStatus | "cancelled";
  className?: string;
}

export function RefundStatusBadge({ status, className }: RefundStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(toneClasses[status], className)}>
      {status === "cancelled" ? "Cancelled" : formatRefundStatus(status)}
    </Badge>
  );
}
