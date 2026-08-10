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
  pushNotificationState,
  replaceNotificationSettingsRequest,
} from "@/apps/admin/communications/lib/communications-api";
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

/**
 * These two keys are now a CACHE of a per-admin server document, not the record
 * itself — see `admin-notification-state.model.ts`.
 *
 * Read and dismissed ids lived only in the browser that clicked, so the same
 * person clearing the bell on the shop laptop found every alert unread again on
 * their phone, and a cleared cache lost the lot. Each mutation below now sends
 * the ids it just changed as a DELTA; `persistServerNotificationState` unions
 * the server's copy back in on load. Nothing here ever sends the whole set, so
 * a stale tab cannot erase what another device recorded — and a failed delta is
 * re-sent by the next hydration rather than reported as saved.
 */
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
  // Only what this browser did not already know goes up. "Mark all read"
  // pressed twice would otherwise re-send two hundred ids the server has held
  // since the first press.
  const fresh = ids.filter((id) => !known.has(id));
  for (const id of ids) known.add(id);
  writeReadIds(known);
  void pushNotificationState({ read: fresh });
}

/** Remember that these ids have been dismissed, on this device and the server. */
function rememberDismissed(ids: string[]): void {
  if (ids.length === 0) return;
  const dismissed = readDismissedIds();
  const fresh = ids.filter((id) => !dismissed.has(id));
  for (const id of ids) dismissed.add(id);
  writeDismissedIds(dismissed);
  void pushNotificationState({ dismissed: fresh });
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
 * Hydration: fold this admin's server-held read/dismissed ids into the local
 * cache, and send back anything the server has not seen.
 *
 * A UNION in both directions, never a replace. Taking the server's copy
 * wholesale would discard a click made before the fetch returned; sending this
 * browser's copy wholesale is the replace-all mistake that this whole file was
 * written to avoid. The upward half is also what migrates an admin who has been
 * using the browser-only version, and what re-sends a delta that failed while
 * the connection was down — the local set is the retry queue.
 *
 * `stock:` dismissals are deliberately NOT re-sent. They describe a condition,
 * not an event, and are pruned the moment the product is back above its
 * threshold — so an id missing from the server is far more likely to be a prune
 * another device already made than a delta this one failed to send, and
 * re-uploading it would race that prune and re-silence a live alert. Losing one
 * costs a row reappearing in the feed, which is the safe direction.
 */
export function persistServerNotificationState(state: {
  read: string[];
  dismissed: string[];
}): void {
  if (typeof window === "undefined") return;

  const localRead = readReadIds();
  const localDismissed = readDismissedIds();
  const serverRead = new Set(state.read);
  const serverDismissed = new Set(state.dismissed);

  const unsentRead = [...localRead].filter((id) => !serverRead.has(id));
  const unsentDismissed = [...localDismissed].filter(
    (id) => !serverDismissed.has(id) && !id.startsWith("stock:"),
  );

  for (const id of serverRead) localRead.add(id);
  for (const id of serverDismissed) localDismissed.add(id);
  writeReadIds(localRead);
  writeDismissedIds(localDismissed);

  void pushNotificationState({ read: unsentRead, dismissed: unsentDismissed });

  // Re-derive so the feed and the bell reflect what just arrived: a dismissal
  // made elsewhere has to remove the row here, and a read made elsewhere has to
  // stop it counting.
  syncNotifications();
  emitNotificationsUpdated();
}

/**
 * Forget dismissals for stock alerts whose condition no longer holds, so the
 * alert can fire again if the product runs low a second time. Also keeps the
 * dismissed set from growing without bound as stock churns.
 */
function pruneResolvedStockDismissals(dismissed: Set<string>, liveIds: Set<string>): void {
  const resolved: string[] = [];

  for (const id of dismissed) {
    if (id.startsWith("stock:") && !liveIds.has(id)) {
      dismissed.delete(id);
      resolved.push(id);
    }
  }

  if (resolved.length === 0) return;
  writeDismissedIds(dismissed);
  // The removal has to reach the server as well. Dropping it locally alone
  // would silence the alert on every other device the second time that product
  // ran low — the dismissal outliving the condition it described, which is the
  // exact thing this prune exists to prevent.
  void pushNotificationState({ undismissed: resolved });
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

  // System alerts are the one kind that is STORED rather than derived, so the
  // dismissed set was never consulted for them — `dismissNotification` simply
  // dropped the row from the stored list. That was survivable while dismissal
  // was per-browser and is not now: one arriving from another device has
  // nothing to delete here, and the row would sit in this feed forever while
  // the admin who dismissed it saw it gone.
  const manual = readStoredNotifications().filter(
    (notification) => notification.type === "system" && !dismissed.has(notification.id),
  );
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
  rememberDismissed([id]);

  const notifications = readStoredNotifications().filter(
    (notification) => notification.id !== id
  );
  writeStoredNotifications(notifications);
}

export function dismissNotifications(ids: string[]): void {
  rememberDismissed(ids);

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

  rememberDismissed(
    notifications.filter((notification) => notification.read).map((n) => n.id),
  );
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

/**
 * Clears the LOCAL caches only. The server keeps this admin's read and
 * dismissed ids, and the next hydration puts them back — which is the correct
 * outcome for a device-level reset and is why READ_KEY is cleared here too
 * rather than being left behind to contradict the set beside it.
 */
export function resetNotificationState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(READ_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  emitNotificationsUpdated();
}
