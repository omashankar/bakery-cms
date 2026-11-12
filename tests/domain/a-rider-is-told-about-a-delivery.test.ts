/**
 * A RIDER IS TOLD ABOUT A DELIVERY.
 *
 * Assigning a rider changed a field and nothing else: the rider found out only
 * if they happened to open My deliveries. A newly assigned rider now gets an
 * email with the order, the day, the area and a link — and the address and
 * the customer's phone stay behind the rider's own sign-in.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; html: string }[], fail: false }));
const order = vi.hoisted(() => ({
  current: {
    id: "o1",
    orderNumber: "BK-20261105-0042",
    status: "ready",
    statusHistory: [],
    items: [{ name: "Chocolate Truffle", quantity: 1 }],
    address: { fullName: "Riya Sharma", phone: "9812345678", email: "riya@example.com", addressLine1: "12 Rose Villa", city: "Kota", pincode: "324001" },
    deliverySlot: { date: "2026-11-05", timeSlot: "10:00 AM – 12:00 PM" },
    deliveryPartner: undefined as { userId?: string; name: string } | undefined,
  },
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findById: async () => order.current,
  patch: async (_id: string, fields: Record<string, unknown>) => {
    order.current = { ...order.current, ...fields } as typeof order.current;
    return order.current;
  },
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async () => undefined,
  requestContext: () => ({ ip: "", userAgent: "" }),
}));
vi.mock("@/features/communications/server/email.service", () => ({
  sendTemplatedEmail: async () => ({ sent: true }),
  publicBaseUrl: async () => "https://shop.example.com",
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ general: { currency: "INR" }, commerce: {} }),
}));
vi.mock("@/lib/server/mail/send-mail", () => ({
  sendMail: async (message: { to: string; subject: string; html: string }) => {
    if (mail.fail) return { sent: false, error: "SMTP down" };
    mail.sent.push(message);
    return { sent: true };
  },
}));
vi.mock("@/features/team/server/team.repository", () => ({
  findMember: async (id: string) =>
    id === "rider-1"
      ? { id, name: "Ravi", email: "ravi@example.com", status: "active", role: "delivery-staff" }
      : { id, name: "Sonu", email: "sonu@example.com", status: "active", role: "delivery-staff" },
}));

import * as service from "@/features/orders/server/order.service";

const CTX = { ip: "1.1.1.1", userAgent: "test" };

beforeEach(() => {
  mail.sent.length = 0;
  mail.fail = false;
  order.current.deliveryPartner = undefined;
});

describe("assigning a rider", () => {
  it("emails the rider the order, the day and the area, with a link to their deliveries", async () => {
    await service.updateDeliveryPartner("o1", { name: "Ravi", userId: "rider-1" }, CTX);
    expect(mail.sent).toHaveLength(1);
    const [message] = mail.sent;
    expect(message.to).toBe("ravi@example.com");
    expect(message.subject).toContain("BK-20261105-0042");
    expect(message.html).toContain("2026-11-05, 10:00 AM – 12:00 PM");
    expect(message.html).toContain("Kota 324001");
    expect(message.html).toContain("https://shop.example.com/admin/deliveries");
  });

  it("keeps the customer's phone and street out of the email", async () => {
    await service.updateDeliveryPartner("o1", { name: "Ravi", userId: "rider-1" }, CTX);
    expect(mail.sent[0].html).not.toContain("9812345678");
    expect(mail.sent[0].html).not.toContain("12 Rose Villa");
  });

  it("says nothing when the same rider is saved again", async () => {
    order.current.deliveryPartner = { userId: "rider-1", name: "Ravi" };
    await service.updateDeliveryPartner("o1", { name: "Ravi", phone: "9000000000", userId: "rider-1" }, CTX);
    expect(mail.sent).toHaveLength(0);
  });

  it("tells the new rider when the delivery moves to someone else", async () => {
    order.current.deliveryPartner = { userId: "rider-1", name: "Ravi" };
    await service.updateDeliveryPartner("o1", { name: "Sonu", userId: "rider-2" }, CTX);
    expect(mail.sent.map((m) => m.to)).toEqual(["sonu@example.com"]);
  });

  it("an outside courier (no team account) gets no email", async () => {
    await service.updateDeliveryPartner("o1", { name: "Courier Co" }, CTX);
    expect(mail.sent).toHaveLength(0);
  });

  it("the assignment stands when the email cannot be sent", async () => {
    mail.fail = true;
    const updated = await service.updateDeliveryPartner("o1", { name: "Ravi", userId: "rider-1" }, CTX);
    expect(updated?.deliveryPartner?.userId).toBe("rider-1");
  });
});
