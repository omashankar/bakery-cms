import type { CustomerSegment } from "@/types/customer";
import {
  formatCustomerSegmentLabel,
  getCustomerSegmentVariant,
} from "@/apps/admin/commerce/lib/customer-profile-utils";
import { Badge } from "@/components/ui/badge";

export function CustomerSegmentBadge({ segment }: { segment: CustomerSegment }) {
  return (
    <Badge variant={getCustomerSegmentVariant(segment)} className="text-[10px]">
      {formatCustomerSegmentLabel(segment)}
    </Badge>
  );
}
