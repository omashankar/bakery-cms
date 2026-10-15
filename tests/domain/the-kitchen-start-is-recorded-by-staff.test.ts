import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WHEN PREPARATION STARTED IS RECORDED BY THE STAFF WHO STARTED IT.
 *
 * The cancellation policy turns on this moment: a made-to-order cake
 * cancelled before it is refunded, after it is not. So it is stamped when
 * staff first move the order into a kitchen step — and never because the
 * order was placed or paid for, and never moved once set.
 */

const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  audit: [] as Record<string, unknown>[],
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findById: async () => (state.order ? { ...state.order } : null),
  patchIfStatus: async (_id: string, expected: string, fields: Record<string, unknown>) => {
    if (state.order?.status !== expected) return null;
    state.order = { ...state.order, ...fields };
    return { ...state.order };
  },
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async (entry: Record<string, unknown>) => {
    state.audit.push(entry);
  },
  requestContext: () => ({ ip: "", userAgent: "" }),
}));
vi.mock("@/features/communications/server/email.service", () => ({
  sendTemplatedEmail: async () => ({ sent: true }),
  publicBaseUrl: () => "",
}));
vi.mock("@/features/communications/server/whatsapp.service", () => ({
  notifyWhatsApp: async () => undefined,
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ general: { currency: "INR" }, commerce: {} }),
}));

import * as service from "@/features/orders/server/order.service";

const CTX = { ip: "", userAgent: "", actorEmail: "baker@shop.test" };

beforeEach(() => {
  state.order = {
    id: "o1",
    orderNumber: "BK-1",
    status: "confirmed",
    paymentStatus: "paid",
    statusHistory: [{ status: "confirmed", at: "2026-10-13T09:00:00.000Z" }],
    address: { fullName: "A", phone: "", email: "" },
    items: [],
  };
  state.audit = [];
});

describe("the moment preparation started", () => {
  it("is not set by placing or paying", () => {
    expect(state.order?.preparationStartedAt).toBeUndefined();
  });

  it("is stamped when staff move the order to Preparing, and audited", async () => {
    await service.updateStatus("o1", "preparing", CTX);

    expect(state.order?.preparationStartedAt).toEqual(expect.any(String));
    const entry = state.audit.find((row) => row.action === "order.status");
    expect((entry?.metadata as Record<string, unknown>).preparationStartedAt).toBe(
      state.order?.preparationStartedAt,
    );
  });

  it("is stamped by a jump straight past Preparing", async () => {
    await service.updateStatus("o1", "ready", CTX);
    expect(state.order?.preparationStartedAt).toEqual(expect.any(String));
  });

  it("is never moved once set", async () => {
    await service.updateStatus("o1", "preparing", CTX);
    const first = state.order?.preparationStartedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.updateStatus("o1", "ready", CTX);
    await service.updateStatus("o1", "out_for_delivery", CTX);

    expect(state.order?.preparationStartedAt).toBe(first);
  });
});
