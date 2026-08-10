import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultNotificationFilters,
  filterNotifications,
} from "@/apps/admin/commerce/lib/notification-utils";
import { NOTIFICATION_GROUPS } from "@/types/notification";
import type { AdminNotification, NotificationType } from "@/types/notification";

vi.mock("@/features/inquiries/lib/inquiries-repository", () => ({ loadInquiries: () => [] }));
vi.mock("@/apps/admin/commerce/lib/inventory-repository", () => ({ getInventoryItems: () => [] }));
vi.mock("@/features/orders/lib/orders", () => ({ getOrders: () => [] }));
vi.mock("@/apps/admin/communications/lib/communications-api", () => ({
  replaceNotificationSettingsRequest: vi.fn(async () => true),
}));

import {
  markAllNotificationsRead,
  markNotificationRead,
  syncNotifications,
} from "@/apps/admin/commerce/lib/notifications-repository";

function notification(
  id: string,
  type: NotificationType,
  read = false,
): AdminNotification {
  return {
    id,
    type,
    title: id,
    message: "",
    href: "/admin",
    read,
    createdAt: "2026-08-01T00:00:00.000Z",
  } as AdminNotification;
}

/**
 * A card and the filter behind it have to mean the same thing.
 *
 * The Stock card counted low_stock + out_of_stock and its click filtered to
 * low_stock alone — so clicking the number hid exactly the products that cannot
 * be sold at all. And three kinds the repository generates were missing from the
 * type list entirely, so a refund request could not be filtered to at all.
 */
describe("filtering the notification feed", () => {
  const feed = [
    notification("a", "low_stock"),
    notification("b", "out_of_stock"),
    notification("c", "order_placed"),
    notification("d", "payment_received"),
    notification("e", "payment_failed"),
    notification("f", "refund_request"),
  ];

  it("shows both kinds of stock alert under the Stock card", () => {
    const shown = filterNotifications(feed, {
      ...defaultNotificationFilters,
      type: "stock_alerts",
    });

    expect(shown.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("shows both kinds of payment alert under the payment group", () => {
    const shown = filterNotifications(feed, {
      ...defaultNotificationFilters,
      type: "payment_alerts",
    });

    expect(shown.map((n) => n.id).sort()).toEqual(["d", "e"]);
  });

  it("still filters to a single type when asked for one", () => {
    const shown = filterNotifications(feed, {
      ...defaultNotificationFilters,
      type: "low_stock",
    });

    expect(shown.map((n) => n.id)).toEqual(["a"]);
  });

  it("can reach a refund request, which had no filter at all", () => {
    const shown = filterNotifications(feed, {
      ...defaultNotificationFilters,
      type: "refund_request",
    });

    expect(shown.map((n) => n.id)).toEqual(["f"]);
  });

  it("groups cover every type they claim to", () => {
    expect(NOTIFICATION_GROUPS.stock_alerts).toEqual(["low_stock", "out_of_stock"]);
    expect(NOTIFICATION_GROUPS.payment_alerts).toEqual([
      "payment_received",
      "payment_failed",
    ]);
  });

  it("shows everything on 'all'", () => {
    expect(filterNotifications(feed, defaultNotificationFilters)).toHaveLength(feed.length);
  });
});

/**
 * Read state used to be carried forward from the last stored list, and that list
 * is derived from the preference switches — so turning "Stock alerts" off and
 * back on brought every alert the admin had already worked through back as
 * unread, and the bell count jumped with it.
 */
describe("what stays read", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const settings = {
    orderAlerts: true,
    paymentAlerts: true,
    stockAlerts: true,
    inquiryAlerts: true,
  };

  it("remembers a single alert across a rebuild of the derived set", () => {
    localStorage.setItem(
      "bakery-cms-admin-notifications",
      JSON.stringify([notification("system:1", "system")]),
    );

    markNotificationRead("system:1");
    // The list is wiped, as it is when a preference toggle re-derives it.
    localStorage.setItem("bakery-cms-admin-notifications", JSON.stringify([]));

    const known = JSON.parse(localStorage.getItem("bakery-cms-notification-read") ?? "[]");
    expect(known).toContain("system:1");
  });

  it("remembers all of them after Mark all read", () => {
    localStorage.setItem(
      "bakery-cms-admin-notifications",
      JSON.stringify([notification("a", "system"), notification("b", "system")]),
    );

    markAllNotificationsRead();

    const known = JSON.parse(localStorage.getItem("bakery-cms-notification-read") ?? "[]");
    expect(known.sort()).toEqual(["a", "b"]);
  });

  it("re-derives a remembered alert as READ, not unread", () => {
    localStorage.setItem(
      "bakery-cms-admin-notifications",
      JSON.stringify([notification("system:kept", "system")]),
    );
    markNotificationRead("system:kept");

    const rebuilt = syncNotifications(settings);

    const kept = rebuilt.find((item) => item.id === "system:kept");
    expect(kept?.read).toBe(true);
  });

  it("leaves an alert nobody has read alone", () => {
    localStorage.setItem(
      "bakery-cms-admin-notifications",
      JSON.stringify([notification("system:fresh", "system")]),
    );

    const rebuilt = syncNotifications(settings);

    expect(rebuilt.find((item) => item.id === "system:fresh")?.read).toBe(false);
  });
});
