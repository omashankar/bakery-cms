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
import { replaceNotificationSettingsRequest } from "@/apps/admin/communications/lib/communications-api";
import {
  formatInquiryTypeLabel,
  getInquiryHref,
} from "./notification-utils";

const STORAGE_KEY = "bakery-cms-admin-notifications";
const SETTINGS_KEY = "bakery-cms-notification-settings";
const DISMISSED_KEY = "bakery-cms-notification-dismissed";
/**
 * The ids the admin has read, kept apart from the notification list itself.
 *
 * Read state used to be carried forward from the LAST STORED LIST, and that
 * list is derived from the preference switches. So switching "Stock alerts"
 * off dropped every stock notification out of the stored set, and switching it
 * back on regenerated them with no read flag to inherit — every alert the
 * admin had already worked through came back unread, and the bell count jumped
 * with it. The same happened to any alert that fell out of the lookback window
 * and returned. A set of ids survives both.
 */
const READ_KEY = "bakery-cms-notification-read";
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

function readReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeReadIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

/** Remember that these ids have been read, whatever the derived set does next. */
function rememberRead(ids: string[]): void {
  if (ids.length === 0) return;
  const known = readReadIds();
  for (const id of ids) known.add(id);
  writeReadIds(known);
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

/**
 * Applies the preferences locally, re-derives the alert list, and pushes to the
 * server. Resolves false when the server rejected the write, so the caller can
 * tell the admin the truth instead of an unconditional "Saved".
 */
export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // syncNotifications writes + emits itself when the derived set changed.
  syncNotifications(settings);
  return replaceNotificationSettingsRequest(settings);
}

/** Hydration: apply the server's notification settings locally (no re-push). */
export function persistServerNotificationSettings(
  settings: NotificationSettings
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  syncNotifications(settings);
  // Settings alone may not change the derived set (so syncNotifications stays
  // quiet), but the open preferences panel still needs to pick them up.
  emitNotificationsUpdated();
}

/**
 * Forget dismissals for stock alerts whose condition no longer holds, so the
 * alert can fire again if the product runs low a second time. Also keeps the
 * dismissed set from growing without bound as stock churns.
 */
function pruneResolvedStockDismissals(dismissed: Set<string>, liveIds: Set<string>): void {
  let changed = false;

  for (const id of dismissed) {
    if (id.startsWith("stock:") && !liveIds.has(id)) {
      dismissed.delete(id);
      changed = true;
    }
  }

  if (changed) writeDismissedIds(dismissed);
}

function mergeReadState(
  generated: AdminNotification[],
  existing: AdminNotification[]
): AdminNotification[] {
  const readMap = new Map(existing.map((item) => [item.id, item.read]));
  // The durable set is consulted too, so an alert that left the derived set
  // and came back does not return as unread — see READ_KEY.
  const readIds = readReadIds();

  return generated.map((notification) => ({
    ...notification,
    read: readIds.has(notification.id) || (readMap.get(notification.id) ?? notification.read),
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

      // Keyed by STATUS as well as order.
      //
      // A single `refund:<id>` meant the refund's whole lifecycle shared one
      // notification id, and two separate mechanisms then suppressed the later
      // states: `mergeReadState` carries the read flag forward by id, so
      // "Refund completed" arrived already marked read once the admin had seen
      // "Refund requested"; and dismissing the request added that id to
      // `dismissed`, which skipped generation entirely from then on. The alert
      // that the money had actually gone out could never raise the bell.
      if (
        settings.paymentAlerts &&
        order.refundRecord &&
        !dismissed.has(`refund:${order.refundRecord.status}:${order.id}`)
      ) {
        const completed = order.refundRecord.status === "completed";
        generated.push({
          id: `refund:${order.refundRecord.status}:${order.id}`,
          type: "refund_request",
          title: `Refund ${completed ? "completed" : order.refundRecord.status} · ${order.orderNumber}`,
          message: `${formatCurrency(order.refundRecord.amount)} · ${order.address.fullName}`,
          href: routes.admin.commerce.refunds,
          entityId: order.id,
          entityKind: "order",
          read: false,
          // Dated when THIS state happened, not when the refund was first asked
          // for.
          //
          // Every stage carried `requestedAt`, so the alert saying the money had
          // actually gone out was filed at the moment the customer requested it —
          // days earlier in a feed sorted newest-first, below orders that arrived
          // since. The one alert an operator most needs to see arrived buried.
          createdAt:
            (completed ? order.refundRecord.completedAt : undefined) ??
            order.refundRecord.requestedAt ??
            order.placedAt,
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
    // A stock alert describes a *state*, not a one-off event, so its dismissal
    // must not outlive the condition. Track which stock ids are live right now
    // and drop dismissals for the ones that have resolved (see the prune below).
    const liveStockIds = new Set<string>();
    const inventory = getInventoryItems();

    for (const item of inventory) {
      if (item.unlimitedStock) continue;

      if (item.stockStatus === "low_stock") {
        const id = `stock:${item.cakeId}:low_stock`;
        liveStockIds.add(id);
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
        liveStockIds.add(id);
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

    // Only prune when the catalogue is actually loaded. An empty inventory here
    // means the product cache has not hydrated yet, not that every stock issue
    // resolved — pruning then would resurrect every alert the admin dismissed.
    if (inventory.length > 0) {
      pruneResolvedStockDismissals(dismissed, liveStockIds);
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

/**
 * Pure counter over an already-derived list. Screens that just called
 * `syncNotifications()` should use this rather than `getNotificationOverview()`,
 * so the cards and the list below them are counted from the same snapshot.
 */
export function buildNotificationOverview(
  notifications: AdminNotification[]
): NotificationOverview {
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

export function getNotificationOverview(): NotificationOverview {
  return buildNotificationOverview(readStoredNotifications());
}

export function markNotificationRead(id: string): void {
  rememberRead([id]);
  const notifications = readStoredNotifications().map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification
  );
  writeStoredNotifications(notifications);
}

export function markNotificationsRead(ids: string[]): void {
  rememberRead(ids);
  const idSet = new Set(ids);
  const notifications = readStoredNotifications().map((notification) =>
    idSet.has(notification.id) ? { ...notification, read: true } : notification
  );
  writeStoredNotifications(notifications);
}

export function markAllNotificationsRead(): void {
  const notifications = readStoredNotifications();
  rememberRead(notifications.map((notification) => notification.id));
  writeStoredNotifications(
    notifications.map((notification) => ({ ...notification, read: true })),
  );
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
