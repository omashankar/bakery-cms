import type { ProductReviewStatus } from "@/types/review";
import { Badge } from "@/components/ui/badge";
import { adminShell } from "@/features/admin/components/admin-shell";
import { cn } from "@/lib/utils";
import { formatReviewStatus, getReviewStatusTone } from "@/features/reviews/lib/review-utils";

const toneClasses = {
  neutral: "border-border bg-muted text-foreground",
  warning: adminShell.toneWarning,
  positive: adminShell.tonePositive,
  destructive: adminShell.toneDestructive,
};

interface ReviewStatusBadgeProps {
  status: ProductReviewStatus;
  className?: string;
}

export function ReviewStatusBadge({ status, className }: ReviewStatusBadgeProps) {
  const tone = getReviewStatusTone(status);
  return (
    <Badge variant="outline" className={cn(toneClasses[tone], className)}>
      {formatReviewStatus(status)}
    </Badge>
  );
}
