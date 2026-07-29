/**
 * The admin order mutations dual-write: localStorage first (so the UI is
 * instant), then the server (which is the source of truth). These pin the
 * contract that makes that safe — the caller must be able to tell a change that
 * reached the server from one that only reached this browser, because the next
 * hydration silently discards the latter.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  bulkUpdateOrderStatus,
  cancelOrder,
  getOrderById,
  ORDERS_UPDATED_EVENT,
  persistServerOrders,
  refundOrder,
  updateOrderStatus,
  type PlacedOrder,
} from "@/features/orders/lib/orders";

function order(overrides: Partial<PlacedOrder> = {}): PlacedOrder {
  const placedAt = new Date().toISOString();
  return {
    id: "order-1",
    orderNumber: "BK-20260729-0001",
    items: [],
    totals: {
      subtotal: 1000,
      delivery: 0,
      tax: 0,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 0,
      taxableAmount: 1000,
      total: 1000,
      itemCount: 1,
    },
    address: {
      fullName: "Test Customer",
      email: "test@example.com",
      phone: "+91 90000 00000",
      addressLine1: "1 Test Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    paymentMethod: "upi",
    paymentStatus: "paid",
    placedAt,
    status: "confirmed",
    statusHistory: [{ status: "confirmed", at: placedAt }],
    ...overrides,
  } as PlacedOrder;
}

/** Stub the dual-write endpoint with a fixed HTTP outcome. */
function mockServer(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin order mutations", () => {
  it("reports persisted when the server accepts the change", async () => {
    persistServerOrders([order()]);
    mockServer(true);

    const result = await updateOrderStatus("order-1", "delivered");

    expect(result.order?.status).toBe("delivered");
    expect(result.persisted).toBe(true);
  });

  it("reports NOT persisted when the server rejects, while still applying locally", async () => {
    persistServerOrders([order()]);
    mockServer(false); // e.g. an expired token 401

    const result = await updateOrderStatus("order-1", "delivered");

    expect(result.order?.status).toBe("delivered");
    expect(result.persisted).toBe(false);
    // The local cache is optimistic on purpose — the point is that the caller
    // is told, not that the local write is rolled back.
    expect(getOrderById("order-1")?.status).toBe("delivered");
  });

  it("reports NOT persisted when the request fails outright", async () => {
    persistServerOrders([order()]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(updateOrderStatus("order-1", "delivered")).resolves.toMatchObject({
      persisted: false,
    });
  });

  it("surfaces a rejected cancellation and refund too", async () => {
    persistServerOrders([order({ id: "a" }), order({ id: "b" })]);
    mockServer(false);

    await expect(cancelOrder("a", "changed mind")).resolves.toMatchObject({ persisted: false });
    await expect(refundOrder("b")).resolves.toMatchObject({ persisted: false });
  });

  it("acts on an order the local cache does not hold, by fetching it", async () => {
    // The admin lists are server-paginated over every order, so an admin
    // routinely opens one older than the browser cache holds. Resolving against
    // the cache alone made every button on that page a silent no-op.
    persistServerOrders([]);
    const remote = order({ id: "remote", status: "confirmed" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          String(url).includes("/api/orders/remote") && !String(url).includes("/status")
            ? { ok: true, json: () => Promise.resolve({ success: true, data: remote }) }
            : { ok: true }
        )
      )
    );

    const result = await updateOrderStatus("remote", "delivered");

    expect(result.order?.status).toBe("delivered");
    expect(result.persisted).toBe(true);
    // and it is now in the cache, so the page can render it
    expect(getOrderById("remote")?.status).toBe("delivered");
  });

  it("returns a null order for an id the server does not have either", async () => {
    persistServerOrders([order()]);
    mockServer(true);

    await expect(updateOrderStatus("nope", "delivered")).resolves.toEqual({
      order: null,
      persisted: false,
    });
  });
});

describe("bulk status update", () => {
  it("sends every selected id, including ones the cache already shows as done", async () => {
    // The local copy showing the target status proves nothing about the server —
    // after a rejected batch it shows that for every order in it. Skipping on
    // that basis turned the admin's retry into a silent no-op.
    persistServerOrders([
      order({ id: "a", status: "confirmed" }),
      order({ id: "b", status: "delivered" }),
    ]);
    const fetchMock = mockServer(true);

    const result = await bulkUpdateOrderStatus(["a", "b"], "delivered");

    expect(result).toEqual({ updated: 2, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends for ids the local cache does not hold at all", async () => {
    // The list is server-paginated over every order, so the admin can select
    // rows far older than the cache holds. Those must still reach the server.
    persistServerOrders([order({ id: "cached" })]);
    const fetchMock = mockServer(true);

    const result = await bulkUpdateOrderStatus(["cached", "uncached"], "delivered");

    expect(result).toEqual({ updated: 2, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports how many the server rejected", async () => {
    persistServerOrders([order({ id: "a" }), order({ id: "b" })]);
    mockServer(false);

    await expect(bulkUpdateOrderStatus(["a", "b"], "delivered")).resolves.toEqual({
      updated: 0,
      failed: 2,
    });
  });

  it("a retry after a wholly rejected batch still reaches the server", async () => {
    persistServerOrders([order({ id: "a" }), order({ id: "b" })]);

    mockServer(false);
    await bulkUpdateOrderStatus(["a", "b"], "delivered");

    // The local cache now says "delivered" for both even though the server
    // never accepted it. The retry must not be short-circuited by that.
    const retryMock = mockServer(true);
    const retry = await bulkUpdateOrderStatus(["a", "b"], "delivered");

    expect(retry).toEqual({ updated: 2, failed: 0 });
    expect(retryMock).toHaveBeenCalledTimes(2);
  });

  it("writes once for the whole batch rather than once per order", async () => {
    persistServerOrders([order({ id: "a" }), order({ id: "b" }), order({ id: "c" })]);
    mockServer(true);

    let events = 0;
    const count = () => {
      events += 1;
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, count);
    await bulkUpdateOrderStatus(["a", "b", "c"], "delivered");
    window.removeEventListener(ORDERS_UPDATED_EVENT, count);

    // One event, not three — every dashboard card, sidebar badge and the
    // notification bell re-derives on each one.
    expect(events).toBe(1);
  });

  it("does nothing when nothing is selected", async () => {
    persistServerOrders([order({ id: "a", status: "delivered" })]);
    const fetchMock = mockServer(true);

    await expect(bulkUpdateOrderStatus([], "delivered")).resolves.toEqual({
      updated: 0,
      failed: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
