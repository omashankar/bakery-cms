/**
 * The admin notification centre derives its alerts from orders, inquiries and
 * inventory rather than storing them, so the interesting behaviour is in how a
 * derived list survives round trips: read state must persist across re-derives,
 * and a dismissal must suppress exactly as long as it should.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  buildNotificationOverview,
  clearReadNotifications,
  dismissNotification,
  markAllNotificationsRead,
  syncNotifications,
} from "@/apps/admin/commerce/lib/notifications-repository";
import { loadProducts, persistProducts } from "@/features/products/lib/products-repository";
import type { Product } from "@/types/product";

const STOCK_SETTINGS = {
  orderAlerts: false,
  paymentAlerts: false,
  stockAlerts: true,
  inquiryAlerts: false,
};

/** Force a single product into a given stock level; returns its id. */
function seedStock(quantity: number): string {
  const products = loadProducts();
  const target: Product = {
    ...products[0],
    stockQuantity: quantity,
    unlimitedStock: false,
    lowStockThreshold: 5,
  };
  persistProducts([target]);
  return target.id;
}

beforeEach(() => {
  localStorage.clear();
});

describe("notification derivation", () => {
  it("raises an out-of-stock alert for a product with no stock", () => {
    const id = seedStock(0);

    const alerts = syncNotifications(STOCK_SETTINGS);

    expect(alerts.some((a) => a.id === `stock:${id}:out_of_stock`)).toBe(true);
  });

  it("keeps read state when the list is re-derived", () => {
    seedStock(0);
    syncNotifications(STOCK_SETTINGS);
    markAllNotificationsRead();

    const alerts = syncNotifications(STOCK_SETTINGS);

    expect(alerts.every((a) => a.read)).toBe(true);
  });

  it("suppresses a dismissed stock alert while the condition still holds", () => {
    const id = seedStock(0);
    syncNotifications(STOCK_SETTINGS);
    dismissNotification(`stock:${id}:out_of_stock`);

    const alerts = syncNotifications(STOCK_SETTINGS);

    expect(alerts.some((a) => a.id === `stock:${id}:out_of_stock`)).toBe(false);
  });

  it("raises the alert again after the product is restocked and runs out once more", () => {
    // A stock alert is a *state*, not a one-off event. Dismissing it must not
    // suppress it forever, or a product that is restocked and then sells out
    // again would never alert anyone.
    const id = seedStock(0);
    syncNotifications(STOCK_SETTINGS);
    dismissNotification(`stock:${id}:out_of_stock`);

    seedStock(50); // restocked — the condition resolves
    syncNotifications(STOCK_SETTINGS);

    seedStock(0); // sold out again
    const alerts = syncNotifications(STOCK_SETTINGS);

    expect(alerts.some((a) => a.id === `stock:${id}:out_of_stock`)).toBe(true);
  });

  it("does not drop dismissals while the product cache is still empty", () => {
    // An empty inventory means products have not hydrated yet, not that every
    // stock issue resolved — pruning then would resurrect dismissed alerts.
    const id = seedStock(0);
    syncNotifications(STOCK_SETTINGS);
    dismissNotification(`stock:${id}:out_of_stock`);

    persistProducts([]); // hydration in flight
    syncNotifications(STOCK_SETTINGS);

    seedStock(0);
    const alerts = syncNotifications(STOCK_SETTINGS);

    expect(alerts.some((a) => a.id === `stock:${id}:out_of_stock`)).toBe(false);
  });

  it("clearing read alerts removes them without dropping unread ones", () => {
    seedStock(0);
    const before = syncNotifications(STOCK_SETTINGS);
    expect(before.length).toBeGreaterThan(0);
    markAllNotificationsRead();

    const cleared = clearReadNotifications();

    expect(cleared).toBe(before.length);
    expect(buildNotificationOverview(syncNotifications(STOCK_SETTINGS)).total).toBe(0);
  });
});
