import {
  AlertTriangle,
  Bell,
  CreditCard,
  MessageSquare,
  Package,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import type { NotificationType } from "@/types/notification";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNotificationType } from "../lib/notification-utils";

const iconMap = {
  order_placed: ShoppingBag,
  payment_received: CreditCard,
  payment_failed: XCircle,
  low_stock: AlertTriangle,
  out_of_stock: Package,
  inquiry_new: MessageSquare,
  system: Bell,
} as const;

const variantMap: Record<
  NotificationType,
  "default" | "secondary" | "destructive" | "outline" | "accent"
> = {
  order_placed: "accent",
  payment_received: "secondary",
  payment_failed: "destructive",
  low_stock: "outline",
  out_of_stock: "destructive",
  inquiry_new: "accent",
  system: "secondary",
};

export function NotificationTypeBadge({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  return (
    <Badge variant={variantMap[type]} className={cn("text-[10px]", className)}>
      {formatNotificationType(type)}
    </Badge>
  );
}

export function NotificationTypeIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const Icon = iconMap[type];
  return <Icon className={cn("size-4 shrink-0", className)} strokeWidth={1.75} />;
}
