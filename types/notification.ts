export type NotificationType =
  | "order_placed"
  | "payment_received"
  | "payment_failed"
  | "low_stock"
  | "out_of_stock"
  | "inquiry_new"
  | "system";

export type NotificationEntityKind = "order" | "cake" | "inquiry";

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  entityId?: string;
  entityKind?: NotificationEntityKind;
  read: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  orderAlerts: boolean;
  paymentAlerts: boolean;
  stockAlerts: boolean;
  inquiryAlerts: boolean;
}

export interface NotificationListFilters {
  search: string;
  type: "all" | NotificationType;
  status: "all" | "unread" | "read";
}

export interface NotificationOverview {
  total: number;
  unread: number;
  orderCount: number;
  paymentCount: number;
  stockCount: number;
  inquiryCount: number;
}
