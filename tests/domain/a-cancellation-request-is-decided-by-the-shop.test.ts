import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A CANCELLATION REQUEST IS DECIDED BY THE SHOP — under the policy the
 * customer agreed to, with a genuine problem never refused by it, and money
 * moved only by the tools that already move it safely.
 *
 * The repository fakes model the guards, not just the shape: opening a
 * request matches only when none exists, and a decision only when the
 * request's version has not moved.
 */

const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  commerce: {} as Record<string, unknown>,
  emails: [] as Array<{ slug: string; to: string; vars: Record<string, string> }>,
  audit: [] as Record<string, unknown>[],
  cancels: [] as Array<{ id: string; notify: unknown }>,
  refunds: [] as Array<Record<string, unknown>>,
  declines: [] as string[],
  refundFails: null as string | null,
  testMode: false,
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findById: async () => (state.order ? structuredClone(state.order) : null),
  findByNumber: async (number: string) =>
    state.order && state.order.orderNumber === number ? structuredClone(state.order) : null,
  openCancellationRequest: async (_id: string, request: Record<string, unknown>) => {
    if (!state.order || state.order.cancellationRequest) return null;
    if (state.order.status === "cancelled" || state.order.status === "refunded") return null;
    state.order = { ...state.order, cancellationRequest: request };
    return structuredClone(state.order);
  },
  compareAndSetCancellation: async (_id: string, expected: number, request: Record<string, unknown>) => {
    const current = state.order?.cancellationRequest as { version: number } | undefined;
    if (!current || current.version !== expected) return null;
    state.order = { ...state.order, cancellationRequest: request };
    return structuredClone(state.order);
  },
  listCancellationCases: async () => [],
}));

vi.mock("@/features/orders/server/order.service", () => ({
  cancel: async (id: string, _reason: string, _ctx: unknown, options: { notifyCustomer?: boolean }) => {
    state.cancels.push({ id, notify: options?.notifyCustomer });
    const paid = state.order?.paymentStatus === "paid";
    state.order = {
      ...state.order,
      status: "cancelled",
      ...(paid ? { refundRecord: { status: "requested", amount: 1000, history: [] } } : {}),
    };
    return structuredClone(state.order);
  },
  refund: async (id: string, input: Record<string, unknown>) => {
    if (state.refundFails) throw new Error(state.refundFails);
    state.refunds.push({ id, ...input });
    state.order = { ...state.order, refundRecord: { status: "processing", amount: input.amount ?? 1000, history: [] } };
    return structuredClone(state.order);
  },
  declineRefund: async (id: string) => {
    state.declines.push(id);
    state.order = { ...state.order, refundRecord: { status: "rejected", amount: 1000, history: [] } };
    return structuredClone(state.order);
  },
}));

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async () => ({ cancellationClass: "made_to_order" }),
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ commerce: state.commerce, general: { currency: "INR" } }),
}));
vi.mock("@/features/communications/server/email.service", () => ({
  sendTemplatedEmail: async (slug: string, to: string, vars: Record<string, string>) => {
    state.emails.push({ slug, to, vars });
    return { sent: true };
  },
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async (entry: Record<string, unknown>) => {
    state.audit.push(entry);
  },
}));
vi.mock("@/lib/server/payments/razorpay-credentials", () => ({
  getRazorpayStatus: async () => ({ testMode: state.testMode }),
}));

const service = await import("@/features/orders/server/cancellation.service");

const CTX = { ip: "", userAgent: "" };
const ADMIN = { ip: "", userAgent: "", actorEmail: "owner@shop.test" };

function harness(over: Record<string, unknown> = {}) {
  state.order = {
    id: "o1",
    orderNumber: "BK-1",
    status: "confirmed",
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    totals: { total: 1000 },
    items: [{ productSlug: "black-forest", name: "Black Forest", quantity: 1 }],
    address: { fullName: "Asha", email: "asha@example.com" },
    statusHistory: [{ status: "confirmed", at: "2026-10-13T09:00:00.000Z" }],
    cancellationPolicy: { policyClass: "made_to_order", version: "p1", text: "", itemClasses: [] },
    ...over,
  };
  state.commerce = {};
  state.emails = [];
  state.audit = [];
  state.cancels = [];
  state.refunds = [];
  state.declines = [];
  state.refundFails = null;
  state.testMode = false;
}

function request() {
  return state.order?.cancellationRequest as {
    status: string;
    eligibility: string;
    version: number;
    decision?: { resolution: string; refundAmount?: number };
    history: Array<{ status: string; note?: string }>;
  };
}

const ask = (reason: string, email = "asha@example.com") =>
  service.requestCancellationAsCustomer("BK-1", email, { reason } as never, CTX);

beforeEach(() => harness());

describe("asking", () => {
  it("before preparation starts: an ordinary request the policy would refund", async () => {
    await ask("changed_mind");
    expect(request().status).toBe("requested");
    expect(request().eligibility).toBe("eligible");
    // Nothing is cancelled or refunded by asking.
    expect(state.cancels).toEqual([]);
    expect(state.refunds).toEqual([]);
    expect(state.emails.map((mail) => mail.slug)).toEqual(["cancellation_requested"]);
  });

  it("after preparation starts: recorded, but not refundable for a change of mind", async () => {
    harness({ status: "preparing", preparationStartedAt: "2026-10-13T10:00:00.000Z" });
    await ask("changed_mind");
    expect(request().eligibility).toBe("non_refundable");
    expect(request().status).toBe("requested");
  });

  it("once ready it is still not refundable; once dispatched a change of mind is refused", async () => {
    harness({ status: "ready" });
    await ask("ordered_by_mistake");
    expect(request().eligibility).toBe("non_refundable");

    harness({ status: "out_for_delivery" });
    await expect(ask("changed_mind")).rejects.toThrow(/already left the shop/);
    expect(state.order?.cancellationRequest).toBeUndefined();
  });

  it("a problem goes straight to review, even after delivery", async () => {
    harness({ status: "delivered" });
    await ask("damaged_or_defective");
    expect(request().status).toBe("under_review");
    expect(request().eligibility).toBe("exception_review");
  });

  it("refuses a stranger's order as if it did not exist", async () => {
    await expect(ask("changed_mind", "someone-else@example.com")).rejects.toThrow(/not found/i);
    expect(state.order?.cancellationRequest).toBeUndefined();
  });

  it("refuses the shop's own reason from a customer", async () => {
    await expect(ask("shop_cannot_fulfil")).rejects.toThrow(/reason/i);
  });

  it("refuses when the shop has switched customer requests off", async () => {
    state.commerce = { customerCancellationRequests: false };
    await expect(ask("changed_mind")).rejects.toThrow(/contact us/i);
  });

  it("opens one request, however many times it is asked", async () => {
    await ask("changed_mind");
    await expect(ask("wrong_item")).rejects.toThrow(/already open/);
    expect(request().history).toHaveLength(1);
  });
});

describe("deciding", () => {
  it("a bakery error, refunded in full: cancels quietly, refunds through the gateway, says so truthfully", async () => {
    await ask("wrong_item");
    const result = await service.decideCancellation(
      "o1",
      { resolution: "full_refund", reason: "Wrong name was piped" },
      ADMIN,
    );

    expect(request().status).toBe("approved");
    expect(state.cancels).toEqual([{ id: "o1", notify: false }]);
    expect(state.refunds).toEqual([
      { id: "o1", reason: "order_cancelled", reasonDetail: "Wrong name was piped" },
    ]);
    expect(result.refundError).toBeUndefined();
    const decided = state.emails.find((mail) => mail.slug === "cancellation_decided");
    expect(decided?.vars.refund_note).toMatch(/started a refund/);
    expect(decided?.vars.refund_note).not.toMatch(/have refunded/);
  });

  it("a partial refund on a delivered order: refunds without cancelling, never more than is held", async () => {
    harness({ status: "delivered" });
    await ask("damaged_or_defective");

    await expect(
      service.decideCancellation("o1", { resolution: "partial_refund", reason: "Top damaged", refundAmount: 5000 }, ADMIN),
    ).rejects.toThrow(/At most/);
    expect(request().status).toBe("under_review");

    await service.decideCancellation(
      "o1",
      { resolution: "partial_refund", reason: "Top damaged", refundAmount: 400 },
      ADMIN,
    );
    expect(state.cancels).toEqual([]);
    expect(state.refunds[0]).toMatchObject({ amount: 400 });
    expect(request().decision).toMatchObject({ resolution: "partial_refund", refundAmount: 400 });
  });

  it("already baked: cancelled with the refund request declined, and the customer told why", async () => {
    harness({ status: "preparing", preparationStartedAt: "2026-10-13T10:00:00.000Z" });
    await ask("changed_mind");
    await service.decideCancellation("o1", { resolution: "cancel_no_refund", reason: "Cake was baked" }, ADMIN);

    expect(state.cancels).toHaveLength(1);
    expect(state.declines).toEqual(["o1"]);
    expect(state.refunds).toEqual([]);
    expect(state.emails.at(-1)?.vars.refund_note).toMatch(/without a refund/);
  });

  it("a remake keeps the order going", async () => {
    harness({ status: "delivered" });
    await ask("wrong_item");
    await service.decideCancellation("o1", { resolution: "remake", reason: "Will remake tomorrow" }, ADMIN);
    expect(request().status).toBe("approved");
    expect(state.cancels).toEqual([]);
    expect(state.refunds).toEqual([]);
  });

  it("decides once: a second decision on the same request is refused", async () => {
    await ask("changed_mind");
    await service.decideCancellation("o1", { resolution: "rejected", reason: "No" }, ADMIN);
    await expect(
      service.decideCancellation("o1", { resolution: "full_refund", reason: "Yes" }, ADMIN),
    ).rejects.toThrow(/already been decided/);
    expect(state.refunds).toEqual([]);
  });

  it("insists on a reason", async () => {
    await ask("changed_mind");
    await expect(service.decideCancellation("o1", { resolution: "rejected", reason: "  " }, ADMIN)).rejects.toThrow(
      /why/,
    );
  });

  it("a refund the gateway will not start leaves the decision standing — and says nothing was refunded", async () => {
    await ask("wrong_item");
    state.refundFails = "Gateway timeout";
    const result = await service.decideCancellation("o1", { resolution: "full_refund", reason: "Our mistake" }, ADMIN);

    expect(result.refundError).toBe("Gateway timeout");
    expect(request().status).toBe("approved");
    expect(request().history.at(-1)?.note).toMatch(/Refund not started/);
    expect(state.emails.at(-1)?.vars.refund_note).toMatch(/nothing has been refunded yet/);
  });

  it("a cash order not yet paid: nothing to refund, and nothing claimed", async () => {
    harness({ paymentMethod: "cod", paymentStatus: "cod" });
    await ask("changed_mind");
    await service.decideCancellation("o1", { resolution: "full_refund", reason: "Before baking" }, ADMIN);
    expect(state.refunds).toEqual([]);
    expect(state.emails.at(-1)?.vars.refund_note).toMatch(/nothing to refund/);
  });
});

describe("test mode", () => {
  it("a simulated refund says no real money moves", async () => {
    state.testMode = true;
    await ask("wrong_item");
    await service.decideCancellation("o1", { resolution: "full_refund", reason: "Test" }, ADMIN);
    expect(state.emails.at(-1)?.vars.refund_note).toMatch(/simulated — no real money moves/);
  });
});
