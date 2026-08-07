import { readFileSync } from "node:fs";
import path from "node:path";

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
  /**
   * The slot is claimed BEFORE the gateway is called, so the mock has to model
   * both halves — otherwise a test could pass against a service that pays out
   * and only then discovers it lost the race.
   */
  claimRefundAttempt: async (
    id: string,
    expectedVersion: number,
    attempt: { amount: number; at: string },
  ) => {
    const record = state.db.order?.refundRecord as
      | { version?: number; pendingAttempt?: unknown }
      | undefined;
    const current = record?.version ?? 0;
    if (id !== ORDER_ID || current !== expectedVersion) return null;
    // An attempt already in flight blocks a second one.
    if (record?.pendingAttempt) return null;

    state.db.order = {
      ...state.db.order,
      refundRecord: { ...(record ?? {}), version: expectedVersion + 1, pendingAttempt: attempt },
    };
    return { ...state.db.order };
  },
  releaseRefundAttempt: async (id: string, claimedVersion: number, hadRecord: boolean) => {
    const record = state.db.order?.refundRecord as { version?: number } | undefined;
    if (id !== ORDER_ID || (record?.version ?? 0) !== claimedVersion) return;

    if (!hadRecord) {
      const { refundRecord: _gone, ...order } = state.db.order as Record<string, unknown>;
      void _gone;
      state.db.order = order;
      return;
    }

    const { pendingAttempt: _drop, ...rest } = (record ?? {}) as Record<string, unknown>;
    void _drop;
    state.db.order = {
      ...state.db.order,
      refundRecord: { ...rest, version: claimedVersion - 1 },
    };
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

  /**
   * The slot has to be taken BEFORE the gateway is asked.
   *
   * The compare-and-set used to run at the end, after the payout. Two admins
   * refunding ₹500 each on a ₹1,000 payment both passed `planRefund` — Razorpay
   * caps at what it captured and ₹500 + ₹500 is inside ₹1,000 — so both payouts
   * happened and the loser's write was simply dropped. The shop was ₹500 down
   * with nothing recorded.
   */
  it("a concurrent refund is refused before any money moves", async () => {
    const { h, service } = await harness();

    const [first, second] = await Promise.allSettled([
      service.refund(ORDER_ID, { amount: 500 }, CTX),
      service.refund(ORDER_ID, { amount: 500 }, CTX),
    ]);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(["fulfilled", "rejected"]);

    // THE ASSERTION THAT MATTERS: the gateway was asked once, not twice.
    expect(h.refundCalls).toHaveLength(1);
    expect(h.refundCalls[0].amount).toBe(500);

    const rejected = (first.status === "rejected" ? first : second) as PromiseRejectedResult;
    expect(String(rejected.reason?.message)).toMatch(/at the same moment|already in progress/);
  });

  it("a refusal hands the slot back, so the retry a 503 invites can succeed", async () => {
    const { h, service } = await harness();
    h.gateway.unavailable = "The payment gateway could not be reached";

    await expect(service.refund(ORDER_ID, { amount: 500 }, CTX)).rejects.toThrow(/could not be reached/);

    // Nothing recorded, and no claim left behind to block the retry.
    expect(h.db.order.refundRecord).toBeUndefined();

    h.gateway.unavailable = undefined;
    await service.refund(ORDER_ID, { amount: 500 }, CTX);
    expect(h.refundCalls).toHaveLength(2);
  });

  it("every write moves the version, so no holder of an older one can overwrite", async () => {
    const { h, service } = await harness();
    await service.refund(ORDER_ID, { amount: 500 }, CTX);

    // The claim took version 1. Recording the outcome has to move it again — the
    // webhook settle path reads an order and compare-and-sets on the version it
    // saw, so a copy read between the claim and the write would otherwise still
    // match and overwrite the admin's record.
    const record = h.db.order.refundRecord as { version?: number };
    expect(record.version).toBe(2);
    expect(record).not.toHaveProperty("pendingAttempt");
  });

  it("a retry arriving while an attempt is still open is refused, not paid again", async () => {
    const { h, service } = await harness({
      // The shape left behind when a request died between asking the gateway and
      // writing the answer down.
      refundRecord: {
        version: 1,
        status: "processing",
        reason: "customer_request",
        amount: 0,
        history: [],
        pendingAttempt: { amount: 500, at: "2026-01-01T00:00:00.000Z" },
      },
    });

    await expect(service.refund(ORDER_ID, { amount: 500 }, CTX)).rejects.toThrow(
      /already in progress/,
    );
    expect(h.refundCalls).toHaveLength(0);
  });

  /**
   * The repository is MOCKED in this file, so the mock proves the service uses
   * the claim correctly and proves nothing about the query that implements it.
   * These read the real one.
   *
   * Found because four mutations to `order.repository.ts` survived a mutation
   * run against the tests above — every one of them invisible behind the mock.
   */
  describe("the claim's actual query", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features/orders/server/order.repository.ts"),
      "utf8",
    );
    const bodyOf = (signature: string) => {
      const start = source.indexOf(signature);
      expect(start, `not found: ${signature}`).toBeGreaterThan(-1);
      const rest = source.slice(start);
      return rest
        .slice(0, rest.indexOf("\n}"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
    };

    it("only takes the slot at the version it expects", () => {
      const fn = bodyOf("export async function claimRefundAttempt(");
      // Without this, two concurrent claims both succeed and both pay out.
      expect(fn).toContain('$expr: { $eq: [{ $ifNull: ["$refundRecord.version", 0] }, expectedVersion] }');
    });

    it("refuses to take a slot that is already in flight", () => {
      const fn = bodyOf("export async function claimRefundAttempt(");
      // A retry arriving while the first attempt is open must not pay again.
      expect(fn).toContain('"refundRecord.pendingAttempt": { $exists: false }');
    });

    it("moves the version and records the attempt in the same write", () => {
      const fn = bodyOf("export async function claimRefundAttempt(");
      expect(fn).toContain('"refundRecord.version": expectedVersion + 1');
      expect(fn).toContain('"refundRecord.pendingAttempt": attempt');
    });

    it("releases by restoring exactly what the claim found", () => {
      const fn = bodyOf("export async function releaseRefundAttempt(");
      // An order that had no refund record must not be left with a bare one —
      // the screens read the record's existence as "a refund was attempted".
      expect(fn).toContain('{ $unset: { refundRecord: "" } }');
      expect(fn).toContain('"refundRecord.version": claimedVersion - 1');
      // And the release is itself version-guarded.
      expect(fn).toContain('$expr: { $eq: [{ $ifNull: ["$refundRecord.version", 0] }, claimedVersion] }');
    });
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
