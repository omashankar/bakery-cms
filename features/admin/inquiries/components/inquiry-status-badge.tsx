import { Badge } from "@/components/ui/badge";
import type { InquiryStatus } from "@/types/inquiry";
import { formatInquiryStatus, getInquiryStatusVariant } from "../lib/inquiry-utils";

interface InquiryStatusBadgeProps {
  status: InquiryStatus;
}

export function InquiryStatusBadge({ status }: InquiryStatusBadgeProps) {
  return (
    <Badge variant={getInquiryStatusVariant(status)}>{formatInquiryStatus(status)}</Badge>
  );
}
