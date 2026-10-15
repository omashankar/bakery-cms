/**
 * BULK "DELIVERED" COULD UN-CANCEL AN ORDER.
 *
 * `updateStatus` read the order, checked the transition, then wrote with no
 * condition. A cancel committing in between — stock already back on the shelf,
 * coupon released — was then overwritten with `delivered` and a history that no
 * longer mentioned it, so the cancelled order counted as revenue again.
 *
 * The write is now conditional on the status that was judged. Here the store
 * moves on between the read and the write, as the cancel would.
 */
import { describe, expect, it, vi } from "vitest";

const state = { status: "preparing" as string, writes: 0 };

vi.mock("@/features/orders/server/order.repository", () => ({
  findById: async () => ({ id: "o1", orderNumber: "BK-1", status: "preparing", statusHistory: [] }),
  patchIfStatus: async (_id: string, expected: string, fields: { status: string }) => {
    if (state.status !== expected) return null;
    state.status = fields.status;
    state.writes += 1;
    return { id: "o1", orderNumber: "BK-1", status: fields.status, statusHistory: [], address: { name: "A", phone: "", email: "" }, items: [] };
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

describe("updateStatus", () => {
  it("refuses when the order was cancelled after it was read", async () => {
    state.status = "cancelled"; // the cancel landed between the read and the write
    state.writes = 0;

    await expect(service.updateStatus("o1", "delivered", CTX)).rejects.toThrow(/changed by someone else/);
    expect(state.status).toBe("cancelled");
    expect(state.writes).toBe(0);
  });

  it("writes when nothing moved", async () => {
    state.status = "preparing";
    const updated = await service.updateStatus("o1", "ready", CTX);
    expect(updated?.status).toBe("ready");
  });
});
