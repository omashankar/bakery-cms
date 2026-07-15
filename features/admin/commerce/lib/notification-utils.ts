import { routes } from "@/constants/routes";
import type { Inquiry, InquiryType } from "@/types/inquiry";
import type {
  AdminNotification,
  NotificationListFilters,
  NotificationType,
} from "@/types/notification";

export const defaultNotificationFilters: NotificationListFilters = {
  search: "",
  type: "all",
  status: "all",
};

export function getInquiryHref(inquiry: Pick<Inquiry, "id" | "type">): string {
  if (inquiry.type === "wedding") return routes.admin.inquiries.wedding;
  if (inquiry.type === "newsletter") return routes.admin.inquiries.newsletter;
  return routes.admin.inquiries.contact;
}

export function formatNotificationType(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    order_placed: "New order",
    payment_received: "Payment received",
    payment_failed: "Payment failed",
    refund_request: "Refund request",
    gateway_error: "Gateway error",
    cod_confirmation: "COD confirmation",
    low_stock: "Low stock",
    out_of_stock: "Out of stock",
    inquiry_new: "New inquiry",
    system: "System",
  };
  return labels[type];
}

export function filterNotifications(
  notifications: AdminNotification[],
  filters: NotificationListFilters
): AdminNotification[] {
  const query = filters.search.trim().toLowerCase();

  return notifications.filter((notification) => {
    if (filters.type !== "all" && notification.type !== filters.type) return false;
    if (filters.status === "unread" && notification.read) return false;
    if (filters.status === "read" && !notification.read) return false;
    if (!query) return true;

    return (
      notification.title.toLowerCase().includes(query) ||
      notification.message.toLowerCase().includes(query) ||
      formatNotificationType(notification.type).toLowerCase().includes(query)
    );
  });
}

export function countActiveNotificationFilters(filters: NotificationListFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.type !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  return count;
}

export function groupNotificationsByDay(
  notifications: AdminNotification[]
): { label: string; items: AdminNotification[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, AdminNotification[]>();

  for (const notification of notifications) {
    const date = new Date(notification.createdAt);
    date.setHours(0, 0, 0, 0);

    let label = "Earlier";
    if (date.getTime() === today.getTime()) {
      label = "Today";
    } else if (date.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    const bucket = groups.get(label) ?? [];
    bucket.push(notification);
    groups.set(label, bucket);
  }

  const order = ["Today", "Yesterday"];
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      }
      return b.localeCompare(a);
    })
    .map(([label, items]) => ({ label, items }));
}

export function formatInquiryTypeLabel(type: InquiryType): string {
  if (type === "wedding") return "Wedding inquiry";
  if (type === "newsletter") return "Newsletter signup";
  return "Contact inquiry";
}
