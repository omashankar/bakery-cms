import {
  TRANSACTION_STATUS_META,
  type TransactionStatus,
} from "@/features/payments/lib/payment-status";
import { cn } from "@/lib/utils";

interface PaymentStatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

/** 12-state transaction status pill. */
export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const meta = TRANSACTION_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
