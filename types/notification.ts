export type NotificationType =
  | "order_placed"
  | "payment_received"
  | "payment_failed"
  | "refund_request"
  | "gateway_error"
  | "cod_confirmation"
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

/** The card groupings, which cover more than one type. */
export type NotificationGroup = "stock_alerts" | "payment_alerts";

export const NOTIFICATION_GROUPS: Record<NotificationGroup, NotificationType[]> = {
  stock_alerts: ["low_stock", "out_of_stock"],
  payment_alerts: ["payment_received", "payment_failed"],
};

export interface NotificationListFilters {
  search: string;
  /**
   * A single type, or a GROUP matching one of the overview cards.
   *
   * The Stock card counts low_stock + out_of_stock and its click filtered to
   * low_stock alone, so clicking the number hid exactly the products that
   * cannot be sold at all. A card and the filter behind it have to mean the
   * same thing.
   */
  type: "all" | NotificationType | NotificationGroup;
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
