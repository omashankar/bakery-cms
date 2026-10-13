import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CANCELLING FROM MY ORDERS — enforced on the server, not only by the button.
 *
 * Only the signed-in customer's own order, only where its products' "Order
 * cancel" toggle allows it, and only before the shop starts preparing it. The
 * cancelling itself is the admin's own `cancel()`, which puts the stock back,
 * emails the customer and opens a refund request for a paid order.
 */

const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  cancels: [] as Array<{ id: string; reason: string }>,
  productClass: "made_to_order" as string | undefined,
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findByNumber: async (number: string) =>
    state.order && state.order.orderNumber === number ? structuredClone(state.order) : null,
}));
vi.mock("@/features/orders/server/order.service", () => ({
  cancel: async (id: string, reason: string) => {
    state.cancels.push({ id, reason });
    state.order = { ...state.order, status: "cancelled" };
    return structuredClone(state.order);
  },
}));
vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async () => ({ cancellationClass: state.productClass }),
}));

const { cancelAsCustomer } = await import("@/features/orders/server/cancellation.service");

const CTX = { ip: "", userAgent: "" };

function harness(over: Record<string, unknown> = {}) {
  state.order = {
    id: "o1",
    orderNumber: "BK-1",
    status: "confirmed",
    paymentStatus: "paid",
    items: [{ productSlug: "cake", quantity: 1 }],
    address: { email: "asha@example.com" },
    statusHistory: [{ status: "confirmed", at: "2026-10-13T09:00:00.000Z" }],
    cancellationPolicy: { policyClass: "made_to_order", version: "p1", text: "", itemClasses: [] },
    ...over,
  };
  state.cancels = [];
  state.productClass = "made_to_order";
}

const cancel = (email = "asha@example.com") => cancelAsCustomer("BK-1", email, "Plans changed", CTX);

beforeEach(() => harness());

describe("cancelling from My Orders", () => {
  it("cancels before preparation starts, through the admin's own cancel", async () => {
    await cancel();
    expect(state.cancels).toEqual([{ id: "o1", reason: "Cancelled by the customer: Plans changed" }]);
  });

  it("refuses once the shop has started preparing", async () => {
    harness({ status: "preparing", preparationStartedAt: "2026-10-13T10:00:00.000Z" });
    await expect(cancel()).rejects.toThrow(/started preparing/);
    expect(state.cancels).toEqual([]);
  });

  it("refuses a product whose Order cancel toggle is off", async () => {
    harness({ cancellationPolicy: { policyClass: "non_cancellable", version: "p1", text: "", itemClasses: [] } });
    await expect(cancel()).rejects.toThrow(/cannot be cancelled/);
    expect(state.cancels).toEqual([]);
  });

  it("judges an order placed before policy copies by its products now", async () => {
    harness({ cancellationPolicy: undefined });
    state.productClass = "non_cancellable";
    await expect(cancel()).rejects.toThrow(/cannot be cancelled/);
  });

  it("answers a stranger's order as if it did not exist", async () => {
    await expect(cancel("someone-else@example.com")).rejects.toThrow(/not found/i);
    expect(state.cancels).toEqual([]);
  });

  it("does not cancel twice", async () => {
    await cancel();
    await expect(cancel()).rejects.toThrow(/already closed/);
    expect(state.cancels).toHaveLength(1);
  });
});
