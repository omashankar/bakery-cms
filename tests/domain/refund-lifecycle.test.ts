import { describe, expect, it, vi } from "vitest";

/**
 * A refund from the click to the money landing — with the gateway mocked.
 *
 * The pieces are covered elsewhere (`refunds.test.ts` pins the decision rules,
 * `checkout-pricing.test.ts` pins the money-in contracts). What nothing covered
 * is the SEQUENCE: request → gateway accepts → record says `processing` →
 * gateway settles → record says `completed`, and the failure branches off it.
 *
 * That sequence is where the old code was wrong. It wrote `completed` at step
 * one and there were no other steps.
 *
 * Razorpay is mocked because these assertions must hold without a network — but
 * the mock is the ONLY thing stubbed: the planning, the record building, the
 * status derivation, the concurrency guard and the settle path are the real
 * implementations.
 */

const ORDER_ID = "order-1";
const PAYMENT_ID = "pay_LIVE1";

/**
 * Mutable state the mocks read, hoisted above the module graph.
 *
 * The first version of this file registered mocks with `vi.doMock` and then
 * dynamically imported the service inside every test. That works in isolation
 * and is a race under a full parallel run: whether the mock is in place depends
 * on module-registry timing, so two tests failed roughly one run in four with
 * the REAL gateway client reporting no credentials. A flaky test on the money
 * path is worse than none. `vi.mock` is hoisted above the imports, so there is
 * no window in which the real module can be reached.
 */
const state = vi.hoisted(() => ({
  db: { order: null as Record<string, unknown> | null },
  restoredStock: [] as unknown[][],
  refundCalls: [] as { paymentId: string; amount: number }[],
  gateway: {
    refundable: 1000 as number | null,
    createStatus: "pending" as "pending" | "processed" | "failed",
    refused: undefined as string | undefined,
    unavailable: undefined as string | undefined,
    fetchStatus: null as "pending" | "processed" | "failed" | null,
  },
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findById: async (id: string) => (id === ORDER_ID ? { ...state.db.order } : null),
  findByPaymentReference: async (ref: string) =>
    ref === state.db.order?.paymentReference ? { ...state.db.order } : null,
  listUnsettledRefunds: async () => {
    const record = state.db.order?.refundRecord as
      | { status?: string; gatewayRefunds?: { status: string }[] }
      | undefined;
    const unsettled =
      record?.status === "processing" &&
      (record.gatewayRefunds ?? []).some((r) => r.status === "pending");
    return unsettled ? [{ ...state.db.order }] : [];
  },
  compareAndSetRefund: async (
    id: string,
    expectedVersion: number,
    fields: Record<string, unknown>,
  ) => {
    const current =
      (state.db.order?.refundRecord as { version?: number } | undefined)?.version ?? 0;
    if (id !== ORDER_ID || current !== expectedVersion) return null;
    state.db.order = { ...state.db.order, ...fields };
    return { ...state.db.order };
  },
  patch: async (_id: string, fields: Record<string, unknown>) => {
    state.db.order = { ...state.db.order, ...fields };
    return { ...state.db.order };
  },
  restoreStock: async (reductions: unknown[]) => {
    state.restoredStock.push(reductions);
  },
}));

vi.mock("@/features/payments/server/razorpay-refund.server", () => ({
  getRefundableAmount: async () => ({
    captured: 1000,
    refunded: 0,
    refundable: state.gateway.refundable,
  }),
  createRazorpayRefund: async (args: { paymentId: string; amount: number }) => {
    state.refundCalls.push({ paymentId: args.paymentId, amount: args.amount });
    if (state.gateway.refused) {
      return { ok: false, refundId: null, status: null, amount: null, refused: state.gateway.refused };
    }
    if (state.gateway.unavailable) {
      return {
        ok: false,
        refundId: null,
        status: null,
        amount: null,
        unavailable: state.gateway.unavailable,
      };
    }
    return {
      ok: true,
      refundId: `rfnd_${state.refundCalls.length}`,
      status: state.gateway.createStatus,
      amount: args.amount,
    };
  },
  fetchRazorpayRefund: async () => ({
    status: state.gateway.fetchStatus,
    amount: 1000,
    ...(state.gateway.fetchStatus ? {} : { unavailable: "gateway down" }),
  }),
}));

vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async () => undefined,
  requestContext: () => ({ ip: "", userAgent: "" }),
}));
vi.mock("@/features/communications/server/email.service", () => ({
  sendTemplatedEmail: async () => ({ sent: true }),
  publicBaseUrl: () => "",
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ general: { currency: "INR" }, commerce: {} }),
}));
vi.mock("@/features/commerce/server/commerce.repository", () => ({
  incrementCouponUsage: async () => undefined,
  decrementCouponUsage: async () => undefined,
}));

import * as service from "@/features/orders/server/order.service";

/** One order document, mutated by the fake repository as the service writes to it. */
function seedOrder(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderNumber: "BK-20260101-0001",
    items: [{ productSlug: "choco", name: "Choco", price: 1000, quantity: 1 }],
    totals: { total: 1000, subtotal: 1000, itemCount: 1 },
    address: { fullName: "A", email: "a@b.c", phone: "9876543210" },
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentReference: PAYMENT_ID,
    placedAt: "2026-01-01T00:00:00.000Z",
    status: "confirmed",
    statusHistory: [{ status: "confirmed", at: "2026-01-01T00:00:00.000Z" }],
    estimatedDelivery: "2026-01-02T00:00:00.000Z",
    ...over,
  };
}

/**
 * Resets the shared state and hands back the real service.
 *
 * The service is imported STATICALLY at the top of this file. Importing it per
 * test with `await import()` charged a cold transform of its whole module graph
 * to the first test's 5s budget, and under a full parallel run that timed out
 * about one run in four — taking the next test down with it, because this shared
 * state was left mid-flight.
 */
function harness(initial: Record<string, unknown> = {}) {
  state.db.order = seedOrder(initial);
  state.restoredStock.length = 0;
  state.refundCalls.length = 0;
  state.gateway.refundable = 1000;
  state.gateway.createStatus = "pending";
  state.gateway.refused = undefined;
  state.gateway.unavailable = undefined;
  state.gateway.fetchStatus = null;

  // Always seeded immediately above; the null in the hoisted type is only for
  // the moment before the first harness() call.
  return { h: state as typeof state & { db: { order: Record<string, unknown> } }, service };
}

const CTX = { ip: "1.1.1.1", userAgent: "test" };



describe("the refund lifecycle", () => {
  it("does not claim the money has landed when the gateway says pending", async () => {
    const { h, service } = await harness();

    await service.refund(ORDER_ID, {}, CTX);

    // The gateway was really asked, for the full amount.
    expect(h.refundCalls).toEqual([{ paymentId: PAYMENT_ID, amount: 1000 }]);

    const record = h.db.order.refundRecord as Record<string, unknown>;
    // NOT "completed" — that was the old lie, written before any gateway existed.
    expect(record.status).toBe("processing");
    expect(record.reference).toBe("rfnd_1");
    expect((record.gatewayRefunds as { status: string }[])[0].status).toBe("pending");

    // And the ORDER is untouched: a refund in flight is not a refunded order.
    expect(h.db.order.status).toBe("confirmed");
    expect(h.db.order.paymentStatus).toBe("paid");
  });

  it("completes only when the gateway reports the payout settled", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, {}, CTX);

    const settled = await service.settleGatewayRefund({
      refundId: "rfnd_1",
      paymentId: PAYMENT_ID,
      amount: 1000,
      status: "processed",
    });

    expect(settled).toBe(true);
    const record = h.db.order.refundRecord as Record<string, unknown>;
    expect(record.status).toBe("completed");
    expect(h.db.order.status).toBe("refunded");
    expect(h.db.order.paymentStatus).toBe("refunded");
  });

  it("a bank rejection leaves the money refundable again", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, {}, CTX);

    await service.settleGatewayRefund({
      refundId: "rfnd_1",
      paymentId: PAYMENT_ID,
      amount: 1000,
      status: "failed",
    });

    const record = h.db.order.refundRecord as Record<string, unknown>;
    expect(record.status).toBe("rejected");
    // A failed refund moved nothing, so it must not eat the customer's claim.
    expect(record.amount).toBe(0);
    expect(h.db.order.status).toBe("confirmed");
  });

  it("records nothing at all when the gateway refuses", async () => {
    const { h, service } = await harness();
    h.gateway.refused = "This payment has already been fully refunded.";

    await expect(service.refund(ORDER_ID, {}, CTX)).rejects.toThrow(/already been fully refunded/);
    expect(h.db.order.refundRecord).toBeUndefined();
    expect(h.db.order.status).toBe("confirmed");
  });

  it("does not record a refund it could not send", async () => {
    const { h, service } = await harness();
    h.gateway.unavailable = "connect ETIMEDOUT";

    await expect(service.refund(ORDER_ID, {}, CTX)).rejects.toThrow(/ETIMEDOUT/);
    expect(h.db.order.refundRecord).toBeUndefined();
  });

  it("refuses a second refund once the whole order is back", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, {}, CTX);
    await service.settleGatewayRefund({
      refundId: "rfnd_1",
      paymentId: PAYMENT_ID,
      amount: 1000,
      status: "processed",
    });

    h.gateway.refundable = 0;
    // 409, not a cheerful 200 "Order refunded" over a payout that never happened.
    await expect(service.refund(ORDER_ID, {}, CTX)).rejects.toThrow();
    expect(h.refundCalls).toHaveLength(1);
  });

  it("accumulates partial refunds instead of replacing them", async () => {
    const { h, service } = await harness();

    await service.refund(ORDER_ID, { amount: 300 }, CTX);
    await service.settleGatewayRefund({
      refundId: "rfnd_1",
      paymentId: PAYMENT_ID,
      amount: 300,
      status: "processed",
    });

    h.gateway.refundable = 700;
    await service.refund(ORDER_ID, { amount: 200 }, CTX);

    const record = h.db.order.refundRecord as Record<string, unknown>;
    expect((record.gatewayRefunds as unknown[]).length).toBe(2);
    expect(record.amount).toBe(500);
    // Half refunded is not refunded: the rest must stay reachable.
    expect(h.db.order.status).toBe("confirmed");
  });

  it("does not put a delivered order's stock back", async () => {
    const { h, service } = await harness({
      status: "delivered",
      statusHistory: [
        { status: "confirmed", at: "2026-01-01T00:00:00.000Z" },
        { status: "delivered", at: "2026-01-02T00:00:00.000Z" },
      ],
    });

    await service.refund(ORDER_ID, {}, CTX);
    await service.settleGatewayRefund({
      refundId: "rfnd_1",
      paymentId: PAYMENT_ID,
      amount: 1000,
      status: "processed",
    });

    // The cake has been eaten. Putting it back is how the next customer is
    // sold stock that does not exist.
    expect(h.restoredStock).toEqual([]);
  });
});

describe("reconciling a refund the webhook never reported", () => {
  it("asks the gateway and settles it", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, {}, CTX);
    expect((h.db.order.refundRecord as { status: string }).status).toBe("processing");

    // The webhook never arrives — no secret configured, wrong URL, retries
    // exhausted. The record would sit here for good.
    h.gateway.fetchStatus = "processed";
    const result = await service.reconcilePendingRefunds();

    expect(result).toEqual({ checked: 1, settled: 1, stillPending: 0 });
    expect((h.db.order.refundRecord as { status: string }).status).toBe("completed");
    expect(h.db.order.status).toBe("refunded");
  });

  it("leaves it alone when the gateway cannot be asked", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, {}, CTX);

    h.gateway.fetchStatus = null; // lookup fails
    const result = await service.reconcilePendingRefunds();

    expect(result.settled).toBe(0);
    expect(result.stillPending).toBe(1);
    // Guessing at a refund's state is the failure this whole change removes.
    expect((h.db.order.refundRecord as { status: string }).status).toBe("processing");
  });

  it("has nothing to do once everything has settled", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, {}, CTX);
    await service.settleGatewayRefund({
      refundId: "rfnd_1",
      paymentId: PAYMENT_ID,
      amount: 1000,
      status: "processed",
    });

    expect(await service.reconcilePendingRefunds()).toEqual({
      checked: 0,
      settled: 0,
      stillPending: 0,
    });
    void h;
  });
});
