import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * Cancelling an order twice.
 *
 * The service read the order, checked the status, then patched — three separate
 * steps — with a comment claiming the check kept the side effects from running
 * twice. It did not. A double-clicked Cancel, or two operators on the same
 * order, both read `confirmed`, both passed, and both restored the stock and
 * released the coupon. A three-cake order ended up six on the shelf, and the
 * customer's single-use code came back twice.
 *
 * The fake repository below models the ATOMICITY, not just the shape: the
 * conditional update either matches or it does not, exactly as Mongo's would.
 * A mock that always succeeded would let a broken service pass.
 */
const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  restoredStock: [] as unknown[][],
  couponReleases: [] as string[],
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findById: async () => (state.order ? { ...state.order } : null),

  cancelIfActive: async (_id: string, fields: Record<string, unknown>) => {
    const status = state.order?.status;
    // The condition IS the guard — `{ status: { $nin: ["cancelled", "refunded"] } }`.
    if (status === "cancelled" || status === "refunded") return null;
    state.order = { ...state.order, ...fields };
    return { ...state.order };
  },

  claimCouponRelease: async () => {
    // `{ couponReleased: { $ne: true } }` — one claim, one winner.
    if (state.order?.couponReleased === true) return false;
    state.order = { ...state.order, couponReleased: true };
    return true;
  },

  restoreStock: async (reductions: unknown[]) => {
    state.restoredStock.push(reductions);
  },
  patch: async (_id: string, fields: Record<string, unknown>) => {
    state.order = { ...state.order, ...fields };
    return { ...state.order };
  },
}));

vi.mock("@/features/commerce/server/commerce.repository", () => ({
  incrementCouponUsage: async () => undefined,
  decrementCouponUsage: async (code: string) => {
    state.couponReleases.push(code);
  },
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

import * as service from "@/features/orders/server/order.service";

const CTX = { ip: "1.1.1.1", userAgent: "test" };

function harness(over: Record<string, unknown> = {}) {
  state.order = {
    id: "order-1",
    orderNumber: "BK-1",
    items: [{ productSlug: "choc", name: "Choc", price: 100, quantity: 3 }],
    totals: { total: 300, subtotal: 300, itemCount: 3 },
    address: { fullName: "A", email: "a@b.c", phone: "1" },
    paymentMethod: "cod",
    paymentStatus: "pending",
    placedAt: "2026-01-01T00:00:00.000Z",
    status: "confirmed",
    statusHistory: [{ status: "confirmed", at: "2026-01-01T00:00:00.000Z" }],
    coupon: { code: "WELCOME10", discountAmount: 30 },
    ...over,
  };
  state.restoredStock.length = 0;
  state.couponReleases.length = 0;
  return state;
}

describe("cancelling twice", () => {
  it("restores the stock once, not once per click", async () => {
    const h = harness();

    await service.cancel("order-1", "changed mind", CTX);
    await service.cancel("order-1", "changed mind", CTX);

    expect(h.restoredStock).toHaveLength(1);
    expect(h.restoredStock[0]).toEqual([{ slug: "choc", quantity: 3 }]);
  });

  it("hands the coupon back once", async () => {
    const h = harness();

    await service.cancel("order-1", undefined, CTX);
    await service.cancel("order-1", undefined, CTX);

    expect(h.couponReleases).toEqual(["WELCOME10"]);
  });

  it("survives two cancels racing each other", async () => {
    const h = harness();

    await Promise.all([
      service.cancel("order-1", undefined, CTX),
      service.cancel("order-1", undefined, CTX),
    ]);

    expect(h.restoredStock).toHaveLength(1);
    expect(h.couponReleases).toHaveLength(1);
  });

  it("still returns the cancelled order to the loser", async () => {
    harness();

    const first = await service.cancel("order-1", undefined, CTX);
    const second = await service.cancel("order-1", undefined, CTX);

    expect(first?.status).toBe("cancelled");
    expect(second?.status).toBe("cancelled");
  });

  it("does not put a delivered order's stock back", async () => {
    // Those cakes have left the building; adding them back invents stock the
    // next customer can be sold.
    const h = harness({ status: "delivered" });

    await service.cancel("order-1", undefined, CTX);

    expect(h.restoredStock).toHaveLength(0);
    // The coupon still comes back — that is not a physical good.
    expect(h.couponReleases).toEqual(["WELCOME10"]);
  });

  it("does nothing at all for an order already cancelled", async () => {
    const h = harness({ status: "cancelled" });

    await service.cancel("order-1", undefined, CTX);

    expect(h.restoredStock).toHaveLength(0);
    expect(h.couponReleases).toHaveLength(0);
  });
});

/**
 * The repository is MOCKED above, so the mock proves the service uses the
 * guards and proves nothing about the queries that implement them.
 *
 * Three mutations to `order.repository.ts` survived a run against the tests
 * above — every one invisible behind the mock. These read the real filters.
 */
describe("the guards' actual queries", () => {
  const source = readFileSync(
    path.join(process.cwd(), "features/orders/server/order.repository.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

  const bodyOf = (signature: string) => {
    const start = source.indexOf(signature);
    expect(start, `not found: ${signature}`).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf("\n}", start));
  };

  it("cancelIfActive only matches an order that is not already finished", () => {
    const fn = bodyOf("export async function cancelIfActive(");
    expect(fn).toContain('status: { $nin: ["cancelled", "refunded"] }');
  });

  it("claimCouponRelease only matches an unreleased order", () => {
    const fn = bodyOf("export async function claimCouponRelease(");
    expect(fn).toContain("couponReleased: { $ne: true }");
  });

  it("claimCouponRelease reports whether IT was the one that claimed", () => {
    // Returning true unconditionally hands every caller a win, and both the
    // cancel and the refund path then release the same coupon.
    const fn = bodyOf("export async function claimCouponRelease(");
    expect(fn).toContain("(res.modifiedCount ?? 0) > 0");
    expect(fn).not.toMatch(/return true;/);
  });
});

describe("cancel then refund", () => {
  it("does not hand the coupon back a second time", async () => {
    // Refunding a cancelled order is the ordinary sequence. The refund tracked
    // its own `refundRecord.couponReleased`, which cancellation never saw.
    const h = harness();

    await service.cancel("order-1", undefined, CTX);
    expect(h.couponReleases).toEqual(["WELCOME10"]);

    // The claim is on the ORDER, so the refund path's release finds it taken.
    expect(h.order?.couponReleased).toBe(true);
  });
});
