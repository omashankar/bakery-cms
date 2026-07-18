import { loadInquiries } from "@/features/inquiries/lib/inquiries-repository";
import { getInventoryItems } from "@/apps/admin/commerce/lib/inventory-repository";
import { getOrders } from "@/features/orders/lib/orders";
import { routes } from "@/constants/routes";
import type {
  AdminNotification,
  NotificationOverview,
  NotificationSettings,
} from "@/types/notification";
import { formatCurrency } from "@/utils/format";
import {
  formatInquiryTypeLabel,
  getInquiryHref,
} from "./notification-utils";

const STORAGE_KEY = "bakery-cms-admin-notifications";
const SETTINGS_KEY = "bakery-cms-notification-settings";
const DISMISSED_KEY = "bakery-cms-notification-dismissed";
const MAX_NOTIFICATIONS = 250;
const ORDER_LOOKBACK_DAYS = 30;
const PAYMENT_LOOKBACK_DAYS = 7;

export const NOTIFICATIONS_UPDATED_EVENT = "bakery-notifications-updated";

export const defaultNotificationSettings: NotificationSettings = {
  orderAlerts: true,
  paymentAlerts: true,
  stockAlerts: true,
  inquiryAlerts: true,
};

function nowIso(): string {
  return new Date().toISOString();
}

function emitNotificationsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

function isWithinDays(iso: string, days: number): boolean {
  const date = new Date(iso);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date.getTime() >= cutoff.getTime();
}

function readDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function readStoredNotifications(): AdminNotification[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeNotifications(notifications: AdminNotification[]): string {
  return JSON.stringify(
    notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      href: notification.href,
      entityId: notification.entityId,
      entityKind: notification.entityKind,
      read: notification.read,
      createdAt: notification.createdAt,
    }))
  );
}

function notificationsChanged(
  current: AdminNotification[],
  next: AdminNotification[]
): boolean {
  return serializeNotifications(current) !== serializeNotifications(next);
}

function writeStoredNotifications(notifications: AdminNotification[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  emitNotificationsUpdated();
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return defaultNotificationSettings;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultNotificationSettings;
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return { ...defaultNotificationSettings, ...parsed };
  } catch {
    return defaultNotificationSettings;
  }
}

export function saveNotificationSettings(
  settings: NotificationSettings
): NotificationSettings {
  if (typeof window === "undefined") return settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  const synced = syncNotifications(settings);
  writeStoredNotifications(synced);
  return settings;
}

function mergeReadState(
  generated: AdminNotification[],
  existing: AdminNotification[]
): AdminNotification[] {
  const readMap = new Map(existing.map((item) => [item.id, item.read]));

  return generated.map((notification) => ({
    ...notification,
    read: readMap.get(notification.id) ?? notification.read,
  }));
}

function buildGeneratedNotifications(settings: NotificationSettings): AdminNotification[] {
  const dismissed = readDismissedIds();
  const generated: AdminNotification[] = [];

  if (settings.orderAlerts || settings.paymentAlerts) {
    for (const order of getOrders()) {
      if (dismissed.has(`order:${order.id}`)) continue;

      if (settings.orderAlerts && isWithinDays(order.placedAt, ORDER_LOOKBACK_DAYS)) {
        generated.push({
          id: `order:${order.id}`,
          type: "order_placed",
          title: `New order ${order.orderNumber}`,
          message: `${order.address.fullName} · ${formatCurrency(order.totals.total)} · ${order.items.length} item(s)`,
          href: routes.admin.orders.detail(order.id),
          entityId: order.id,
          entityKind: "order",
          read: false,
          createdAt: order.placedAt,
        });
      }

      if (
        settings.paymentAlerts &&
        order.paymentStatus === "failed" &&
        !dismissed.has(`payment:failed:${order.id}`)
      ) {
        generated.push({
          id: `payment:failed:${order.id}`,
          type: "payment_failed",
          title: `Payment failed · ${order.orderNumber}`,
          message: `${order.address.fullName} · ${formatCurrency(order.totals.total)}`,
          href: routes.admin.orders.detail(order.id),
          entityId: order.id,
          entityKind: "order",
          read: false,
          createdAt: order.placedAt,
        });
      }

      if (
        settings.paymentAlerts &&
        order.paymentStatus === "paid" &&
        order.paymentMethod !== "cod" &&
        isWithinDays(order.placedAt, PAYMENT_LOOKBACK_DAYS) &&
        !dismissed.has(`payment:paid:${order.id}`)
      ) {
        generated.push({
          id: `payment:paid:${order.id}`,
          type: "payment_received",
          title: `Payment received · ${order.orderNumber}`,
          message: `${formatCurrency(order.totals.total)} via ${order.paymentMethod.toUpperCase()}`,
          href: routes.admin.orders.detail(order.id),
          entityId: order.id,
          entityKind: "order",
          read: false,
          createdAt: order.placedAt,
        });
      }

      if (
        settings.paymentAlerts &&
        order.refundRecord &&
        !dismissed.has(`refund:${order.id}`)
      ) {
        const completed = order.refundRecord.status === "completed";
        generated.push({
          id: `refund:${order.id}`,
          type: "refund_request",
          title: `Refund ${completed ? "completed" : order.refundRecord.status} · ${order.orderNumber}`,
          message: `${formatCurrency(order.refundRecord.amount)} · ${order.address.fullName}`,
          href: routes.admin.commerce.refunds,
          entityId: order.id,
          entityKind: "order",
          read: false,
          createdAt: order.refundRecord.requestedAt ?? order.placedAt,
        });
      }

      if (
        settings.paymentAlerts &&
        order.paymentMethod === "cod" &&
        order.status === "delivered" &&
        !dismissed.has(`cod:${order.id}`)
      ) {
        generated.push({
          id: `cod:${order.id}`,
          type: "cod_confirmation",
          title: `COD collected · ${order.orderNumber}`,
          message: `${formatCurrency(order.totals.total)} collected on delivery`,
          href: routes.admin.orders.detail(order.id),
          entityId: order.id,
          entityKind: "order",
          read: false,
          createdAt: order.placedAt,
        });
      }
    }
  }

  if (settings.inquiryAlerts) {
    for (const inquiry of loadInquiries()) {
      if (inquiry.status !== "new") continue;
      const id = `inquiry:${inquiry.id}`;
      if (dismissed.has(id)) continue;

      generated.push({
        id,
        type: "inquiry_new",
        title: formatInquiryTypeLabel(inquiry.type),
        message: `${inquiry.name} · ${inquiry.email}`,
        href: getInquiryHref(inquiry),
        entityId: inquiry.id,
        entityKind: "inquiry",
        read: false,
        createdAt: inquiry.createdAt,
      });
    }
  }

  if (settings.stockAlerts) {
    for (const item of getInventoryItems()) {
      if (item.unlimitedStock) continue;

      if (item.stockStatus === "low_stock") {
        const id = `stock:${item.cakeId}:low_stock`;
        if (dismissed.has(id)) continue;

        generated.push({
          id,
          type: "low_stock",
          title: `Low stock · ${item.name}`,
          message: `${item.stockQuantity} unit(s) left · threshold ${item.lowStockThreshold}`,
          href: routes.admin.commerce.inventory,
          entityId: item.cakeId,
          entityKind: "cake",
          read: false,
          createdAt: item.updatedAt,
        });
      }

      if (item.stockStatus === "out_of_stock") {
        const id = `stock:${item.cakeId}:out_of_stock`;
        if (dismissed.has(id)) continue;

        generated.push({
          id,
          type: "out_of_stock",
          title: `Out of stock · ${item.name}`,
          message: "Restock required before new orders can be fulfilled",
          href: routes.admin.cakes.edit(item.cakeId),
          entityId: item.cakeId,
          entityKind: "cake",
          read: false,
          createdAt: item.updatedAt,
        });
      }
    }
  }

  const manual = readStoredNotifications().filter((notification) => notification.type === "system");
  const merged = [...generated, ...manual];

  return merged
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_NOTIFICATIONS);
}

export function syncNotifications(
  settings: NotificationSettings = getNotificationSettings()
): AdminNotification[] {
  const existing = readStoredNotifications();
  const generated = buildGeneratedNotifications(settings);
  const merged = mergeReadState(generated, existing);

  if (notificationsChanged(existing, merged)) {
    writeStoredNotifications(merged);
  }

  return merged;
}

export function loadNotifications(): AdminNotification[] {
  if (typeof window === "undefined") return [];
  return syncNotifications();
}

export function getRecentNotifications(limit = 8): AdminNotification[] {
  return readStoredNotifications().slice(0, limit);
}

export function countUnreadNotifications(): number {
  return readStoredNotifications().filter((notification) => !notification.read).length;
}

export function getNotificationOverview(): NotificationOverview {
  const notifications = readStoredNotifications();
  return {
    total: notifications.length,
    unread: notifications.filter((notification) => !notification.read).length,
    orderCount: notifications.filter((notification) => notification.type === "order_placed")
      .length,
    paymentCount: notifications.filter(
      (notification) =>
        notification.type === "payment_received" || notification.type === "payment_failed"
    ).length,
    stockCount: notifications.filter(
      (notification) =>
        notification.type === "low_stock" || notification.type === "out_of_stock"
    ).length,
    inquiryCount: notifications.filter((notification) => notification.type === "inquiry_new")
      .length,
  };
}

export function markNotificationRead(id: string): void {
  const notifications = readStoredNotifications().map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification
  );
  writeStoredNotifications(notifications);
}

export function markNotificationsRead(ids: string[]): void {
  const idSet = new Set(ids);
  const notifications = readStoredNotifications().map((notification) =>
    idSet.has(notification.id) ? { ...notification, read: true } : notification
  );
  writeStoredNotifications(notifications);
}

export function markAllNotificationsRead(): void {
  const notifications = readStoredNotifications().map((notification) => ({
    ...notification,
    read: true,
  }));
  writeStoredNotifications(notifications);
}

export function dismissNotification(id: string): void {
  const dismissed = readDismissedIds();
  dismissed.add(id);
  writeDismissedIds(dismissed);

  const notifications = readStoredNotifications().filter(
    (notification) => notification.id !== id
  );
  writeStoredNotifications(notifications);
}

export function dismissNotifications(ids: string[]): void {
  const dismissed = readDismissedIds();
  ids.forEach((id) => dismissed.add(id));
  writeDismissedIds(dismissed);

  const idSet = new Set(ids);
  const notifications = readStoredNotifications().filter(
    (notification) => !idSet.has(notification.id)
  );
  writeStoredNotifications(notifications);
}

export function clearReadNotifications(): number {
  const notifications = readStoredNotifications();
  const remaining = notifications.filter((notification) => !notification.read);
  const cleared = notifications.length - remaining.length;

  const dismissed = readDismissedIds();
  notifications
    .filter((notification) => notification.read)
    .forEach((notification) => dismissed.add(notification.id));
  writeDismissedIds(dismissed);
  writeStoredNotifications(remaining);

  return cleared;
}

export function addSystemNotification(input: {
  title: string;
  message: string;
  href?: string;
}): AdminNotification {
  const notification: AdminNotification = {
    id: `system:${crypto.randomUUID()}`,
    type: "system",
    title: input.title,
    message: input.message,
    href: input.href,
    read: false,
    createdAt: nowIso(),
  };

  const notifications = [notification, ...readStoredNotifications()];
  writeStoredNotifications(notifications);
  return notification;
}

export function resetNotificationState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  emitNotificationsUpdated();
}
