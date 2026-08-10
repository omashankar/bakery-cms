import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultNotificationFilters,
  filterNotifications,
} from "@/apps/admin/commerce/lib/notification-utils";
import { NOTIFICATION_GROUPS } from "@/types/notification";
import type { AdminNotification, NotificationType } from "@/types/notification";

const shelf = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock("@/features/inquiries/lib/inquiries-repository", () => ({ loadInquiries: () => [] }));
vi.mock("@/apps/admin/commerce/lib/inventory-repository", () => ({
  getInventoryItems: () => shelf.items,
}));
vi.mock("@/features/orders/lib/orders", () => ({ getOrders: () => [] }));
const pushed = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/apps/admin/communications/lib/communications-api", () => ({
  replaceNotificationSettingsRequest: vi.fn(async () => true),
  pushNotificationState: pushed,
}));

import {
  clearReadNotifications,
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
  persistServerNotificationState,
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

/**
 * Read and dismissed state used to live in two localStorage keys, so it was
 * per BROWSER. The same admin clearing the bell on the shop laptop found every
 * alert unread again on their phone, dismissed each one twice, and lost the lot
 * on a cache clear. It is a per-admin server document now — but the way it is
 * written matters as much as where it is kept: a whole-set PUT from a tab
 * opened yesterday would erase everything recorded on another device in
 * between, which is the failure every other store in this codebase had to be
 * repaired for. So every mutation sends only the ids it changed.
 */
describe("read and dismissed state outlives the browser", () => {
  const settings = {
    orderAlerts: true,
    paymentAlerts: true,
    stockAlerts: true,
    inquiryAlerts: true,
  };

  const readIds = () => JSON.parse(localStorage.getItem("bakery-cms-notification-read") ?? "[]");
  const dismissedIds = () =>
    JSON.parse(localStorage.getItem("bakery-cms-notification-dismissed") ?? "[]");
  const store = (items: AdminNotification[]) =>
    localStorage.setItem("bakery-cms-admin-notifications", JSON.stringify(items));

  beforeEach(() => {
    localStorage.clear();
    shelf.items = [];
    pushed.mockClear();
  });

  it("sends a read to the server, not just to this tab", () => {
    store([notification("order:1", "order_placed")]);

    markNotificationRead("order:1");

    expect(pushed).toHaveBeenCalledWith({ read: ["order:1"] });
  });

  it("sends only what changed, never the whole set", () => {
    store([notification("a", "system"), notification("b", "system")]);

    markNotificationRead("a");
    markNotificationRead("b");

    // The second call must not re-assert "a" — and above all must not be able
    // to assert the ABSENCE of anything the server learned in between.
    expect(pushed).toHaveBeenLastCalledWith({ read: ["b"] });
  });

  it("says nothing when the id was already known", () => {
    store([notification("a", "system")]);
    markNotificationRead("a");
    pushed.mockClear();

    markNotificationRead("a");

    expect(pushed).toHaveBeenCalledWith({ read: [] });
  });

  it("sends a dismissal, and a bulk clear, to the server", () => {
    store([notification("a", "system")]);
    dismissNotification("a");
    expect(pushed).toHaveBeenCalledWith({ dismissed: ["a"] });

    pushed.mockClear();
    store([notification("b", "system", true), notification("c", "system")]);
    clearReadNotifications();

    expect(pushed).toHaveBeenCalledWith({ dismissed: ["b"] });
  });

  it("shows an alert read on another device as read here", () => {
    store([notification("system:elsewhere", "system")]);

    persistServerNotificationState({ read: ["system:elsewhere"], dismissed: [] });

    expect(readIds()).toContain("system:elsewhere");
    expect(syncNotifications(settings).find((n) => n.id === "system:elsewhere")?.read).toBe(true);
  });

  it("removes a row dismissed on another device", () => {
    store([notification("system:gone", "system"), notification("system:kept", "system")]);

    persistServerNotificationState({ read: [], dismissed: ["system:gone"] });

    const ids = syncNotifications(settings).map((n) => n.id);
    expect(ids).toContain("system:kept");
    expect(ids).not.toContain("system:gone");
  });

  it("keeps what this device knew that the server did not", () => {
    store([notification("local", "system")]);
    markNotificationRead("local");
    pushed.mockClear();

    persistServerNotificationState({ read: ["remote"], dismissed: [] });

    // A union, both ways: nothing local is discarded, and the id the server
    // never received is sent up — which is what migrates an admin off the
    // browser-only version and what retries a delta lost to a dead connection.
    expect(readIds().sort()).toEqual(["local", "remote"]);
    expect(pushed).toHaveBeenCalledWith({ read: ["local"], dismissed: [] });
  });

  it("tells the server when a resolved stock alert stops being dismissed", () => {
    localStorage.setItem(
      "bakery-cms-notification-dismissed",
      JSON.stringify(["stock:cake-1:low_stock"]),
    );
    // Restocked: the id is no longer generated, so the dismissal has outlived
    // the condition it described.
    shelf.items = [
      {
        cakeId: "cake-1",
        name: "Choc",
        stockStatus: "in_stock",
        stockQuantity: 40,
        lowStockThreshold: 5,
        unlimitedStock: false,
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    syncNotifications(settings);

    expect(dismissedIds()).not.toContain("stock:cake-1:low_stock");
    expect(pushed).toHaveBeenCalledWith({ undismissed: ["stock:cake-1:low_stock"] });
  });

  it("does not re-upload a stock dismissal another device has already pruned", () => {
    localStorage.setItem(
      "bakery-cms-notification-dismissed",
      JSON.stringify(["stock:cake-1:low_stock", "order:9"]),
    );

    persistServerNotificationState({ read: [], dismissed: [] });

    // Absent from the server is far likelier to be a prune elsewhere than a
    // delta this browser failed to send; re-sending it would race that prune
    // and silence an alert for a product that is low again.
    expect(pushed).toHaveBeenCalledWith({ read: [], dismissed: ["order:9"] });
  });
});
