/**
 * A CUSTOMER HAD TWO WAYS TO READ THEIR ORDERS, AND ONE OF THEM HID NOTHING.
 *
 * The lookup by order number strips `adminNotes` and the refund notes — the
 * staff's "Internal notes" and their reasons for a refund decision. My Orders
 * (`/api/customer-auth/orders`) returned the whole document, so a signed-in
 * customer could read what the shop had written about them in the response.
 *
 * Driven through the controller with the session and the store mocked, so the
 * assertion is on the JSON a customer's browser actually receives.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/customer-dal", () => ({
  requireCustomer: async () => ({ email: "asha@example.in" }),
  getCustomerAccount: async () => null,
}));

vi.mock("@/features/orders/server/order.service", () => ({
  getByCustomer: async () => [
    {
      id: "o1",
      orderNumber: "BK-1001",
      address: { email: "asha@example.in" },
      adminNotes: "Customer was rude on the phone — refuse further refunds",
      refundRecord: {
        amount: 200,
        notes: "Goodwill only, do not repeat",
        history: [{ amount: 200, note: "Approved by owner reluctantly" }],
      },
    },
  ],
}));

import { myOrdersController } from "@/features/customer-auth/server/customer-auth.controller";

describe("My Orders", () => {
  it("never sends the staff's notes to the customer", async () => {
    const response = await myOrdersController();
    const body = JSON.stringify(await response.json());

    expect(body).toContain("BK-1001");
    expect(body).not.toContain("refuse further refunds");
    expect(body).not.toContain("do not repeat");
    expect(body).not.toContain("reluctantly");
  });
});
