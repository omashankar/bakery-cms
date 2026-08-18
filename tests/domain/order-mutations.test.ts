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
  updateOrderAdminNotes,
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
function mockServer(ok: boolean, status = ok ? 200 : 0) {
  // `status` distinguishes the server REFUSING (4xx) from the request not
  // landing at all. 0 stands for the latter, which is what a dropped fetch
  // looks like to `sendWithStatus`.
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ message: "An order cannot move backwards" }),
  } as unknown as Response);
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

describe("concurrent mutations", () => {
  it("does not let one mutation revert another's field", async () => {
    // Both resolve the order, then both write. Each writes a whole order object,
    // so if the second builds its copy from the state it read BEFORE the first
    // landed, saving notes silently reverts the status change beside it.
    persistServerOrders([order({ id: "o", status: "confirmed" })]);
    mockServer(true);

    const statusChange = updateOrderStatus("o", "delivered");
    const notesChange = updateOrderAdminNotes("o", "Call before delivery");
    await Promise.all([statusChange, notesChange]);

    const finalOrder = getOrderById("o");
    expect(finalOrder?.status).toBe("delivered");
    expect(finalOrder?.adminNotes).toBe("Call before delivery");
  });

  it("keeps both changes when the slower one resolves from the server", async () => {
    // The order is NOT cached, so each mutation awaits a server read first —
    // widening the window in which the other can land.
    persistServerOrders([]);
    const remote = order({ id: "remote", status: "confirmed" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          String(url).endsWith("/api/orders/remote")
            ? { ok: true, json: () => Promise.resolve({ success: true, data: remote }) }
            : { ok: true }
        )
      )
    );

    await Promise.all([
      updateOrderStatus("remote", "delivered"),
      updateOrderAdminNotes("remote", "Leave at reception"),
    ]);

    const finalOrder = getOrderById("remote");
    expect(finalOrder?.status).toBe("delivered");
    expect(finalOrder?.adminNotes).toBe("Leave at reception");
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

    expect(result).toEqual({ updated: 2, failed: 0, refused: 0, reason: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends for ids the local cache does not hold at all", async () => {
    // The list is server-paginated over every order, so the admin can select
    // rows far older than the cache holds. Those must still reach the server.
    persistServerOrders([order({ id: "cached" })]);
    const fetchMock = mockServer(true);

    const result = await bulkUpdateOrderStatus(["cached", "uncached"], "delivered");

    expect(result).toEqual({ updated: 2, failed: 0, refused: 0, reason: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports how many the server rejected", async () => {
    persistServerOrders([order({ id: "a" }), order({ id: "b" })]);
    mockServer(false);

    await expect(bulkUpdateOrderStatus(["a", "b"], "delivered")).resolves.toMatchObject({
      updated: 0,
      failed: 2,
      // A dropped request, not a rule: nothing to explain and worth retrying.
      refused: 0,
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

    expect(retry).toEqual({ updated: 2, failed: 0, refused: 0, reason: undefined });
    expect(retryMock).toHaveBeenCalledTimes(2);
  });

  it("tells a rule the server enforces from a request that went missing", async () => {
    /**
     * Every failure was counted the same way and reported as "did not reach the
     * server — those changes exist on this device only". For a transition the
     * server refuses BY RULE that is wrong twice: the server answered, and
     * nothing was kept anywhere. The admin's only move was to retry, forever,
     * because the fulfilment ladder does not run backwards.
     */
    persistServerOrders([order({ id: "a", status: "delivered" })]);
    mockServer(false, 409);

    const result = await bulkUpdateOrderStatus(["a"], "preparing");

    expect(result.failed).toBe(1);
    expect(result.refused, "a 409 was reported as a dropped request").toBe(1);
    expect(result.reason, "the server's explanation was discarded").toBeTruthy();
  });

  it("does not call a 401 a rule the server enforces", async () => {
    /**
     * A refusal here is reported as a permanent rule — "an order cannot go back
     * down the fulfilment ladder. Nothing was changed." — and the caller undoes
     * its optimistic write on the strength of it. 401 was inside the `4xx means
     * the server decided` band, so on an expired session every id in the batch
     * landed there: the admin was told a rule they had not broken, about orders
     * nothing had happened to, and given no reason to try again after signing
     * back in.
     *
     * 403 stays a refusal — a permission this account does not have is a real
     * answer from a live session.
     */
    persistServerOrders([order({ id: "a", status: "confirmed" })]);
    mockServer(false, 401);

    const result = await bulkUpdateOrderStatus(["a"], "preparing");

    expect(result.failed).toBe(1);
    expect(result.refused, "a 401 was reported as a rule the shop enforces").toBe(0);
  });

  it("undoes the optimistic write for a 401, not only for a rule refusal", async () => {
    /**
     * Excluding 401 from `refused` fixed the message and turned the ROLLBACK
     * off with it — the gate was `refusals.length > 0`. So a batch on a dead
     * session left the fabricated status and its fabricated history entry in
     * the cache, and that poisoned row then became the baseline: the retry
     * skips ids whose status already matches, so nothing is written and the
     * rollback can never fire for that row again.
     */
    persistServerOrders([order({ id: "a", status: "confirmed" })]);
    mockServer(false, 401);
    const before = getOrderById("a")!.statusHistory;

    await bulkUpdateOrderStatus(["a"], "preparing");

    const cached = getOrderById("a");
    expect(cached?.status, "a refused-by-401 status was left in the cache").toBe("confirmed");
    expect(cached?.statusHistory, "a transition that never happened is in the timeline").toEqual(
      before,
    );
  });

  it("keeps the optimistic write when the request merely dropped, even now", async () => {
    // The rollback widened to cover 401; it must not have swallowed the case it
    // was always meant to leave alone.
    persistServerOrders([order({ id: "a", status: "confirmed" })]);
    mockServer(false, 0);

    await bulkUpdateOrderStatus(["a"], "delivered");

    expect(getOrderById("a")?.status).toBe("delivered");
  });

  it("still calls a 403 a refusal", async () => {
    persistServerOrders([order({ id: "a", status: "confirmed" })]);
    mockServer(false, 403);

    const result = await bulkUpdateOrderStatus(["a"], "preparing");

    expect(result.refused, "a permission decision stopped counting as one").toBe(1);
  });

  it("undoes the optimistic write for an order the server refused", async () => {
    // A refusal is permanent, so leaving the target status in the cache shows
    // the admin a change that will never exist — and invites the retry that
    // can never succeed.
    persistServerOrders([order({ id: "a", status: "delivered" })]);
    mockServer(false, 409);
    const before = getOrderById("a")!.statusHistory;

    await bulkUpdateOrderStatus(["a"], "preparing");

    const cached = getOrderById("a");
    expect(cached?.status, "the refused status was left in the cache").toBe("delivered");
    /**
     * The TIMELINE goes back too, and only the status was checked.
     *
     * Restoring the status alone left the entry the optimistic pass appended,
     * so the order page kept showing a "Preparing" transition the server had
     * refused — and the next full write of that row carried it to the server.
     */
    expect(
      cached?.statusHistory.some((entry) => entry.status === "preparing"),
      "the refused transition stayed in the order's timeline",
    ).toBe(false);
    expect(cached?.statusHistory).toEqual(before);
  });

  it("still keeps the optimistic write when the request merely dropped", async () => {
    // The other half: a dropped request IS worth retrying, and blanking the
    // row would hide what the admin just did.
    persistServerOrders([order({ id: "a", status: "confirmed" })]);
    mockServer(false, 0);

    const result = await bulkUpdateOrderStatus(["a"], "delivered");

    expect(result.refused).toBe(0);
    expect(getOrderById("a")?.status).toBe("delivered");
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
      refused: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
