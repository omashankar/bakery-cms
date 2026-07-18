import type { TemplateStatus } from "@/types/communication";
import { Badge } from "@/components/ui/badge";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { cn } from "@/lib/utils";
import { formatTemplateStatus, getTemplateStatusTone } from "../lib/template-utils";

const toneClasses = {
  positive: adminShell.tonePositive,
  neutral: "border-border bg-muted text-foreground",
};

interface TemplateStatusBadgeProps {
  status: TemplateStatus;
  className?: string;
}

export function TemplateStatusBadge({ status, className }: TemplateStatusBadgeProps) {
  const tone = getTemplateStatusTone(status);
  return (
    <Badge variant="outline" className={cn(toneClasses[tone], className)}>
      {formatTemplateStatus(status)}
    </Badge>
  );
}
