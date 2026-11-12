/**
 * EVERY API CHECKS THE PERMISSION — directly, whatever the screen shows.
 *
 * The real controllers, called the way a curl would call them, by each default
 * role. Only the database underneath is faked; the permission rule is the real
 * one (tests/stubs/access.ts). A controller that asked for the wrong
 * permission, or none, fails here — hiding its button in the browser would not
 * help it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_ROLES, type Permission } from "@/features/team/lib/permissions";

const signedIn = vi.hoisted(() => ({ actor: null as unknown }));
vi.mock("@/lib/server/auth/access", async () =>
  (await import("@/tests/stubs/access")).accessStub(() => signedIn.actor as never),
);

const order = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  updateStatus: vi.fn(),
  cancel: vi.fn(),
  refund: vi.fn(),
  getOrdersPage: vi.fn(async () => ({ items: [], total: 0 })),
}));
vi.mock("@/features/orders/server/order.service", () => ({
  getById: async () => order.current,
  getByNumber: async () => order.current,
  getOrdersPage: order.getOrdersPage,
  updateStatus: order.updateStatus,
  cancel: order.cancel,
  refund: order.refund,
  getKitchenQueue: async () => (order.current ? [order.current] : []),
  getAssignedDeliveries: async () => (order.current ? [order.current] : []),
}));
vi.mock("@/features/orders/server/order.analytics", () => ({
  analyticsForViewer: (a: unknown) => a,
  getOrderAnalytics: async () => ({ summary: { revenue: 1000 }, topCustomers: [], recentOrders: [] }),
  getCommerceOverviews: vi.fn(),
  getInvoicesPage: vi.fn(),
  getRefundCasesPage: vi.fn(),
  getTransactionsPage: vi.fn(),
}));
vi.mock("@/features/team/server/team.service", () => ({ deliveryMemberById: vi.fn() }));
vi.mock("@/features/settings/server/maintenance.server", () => ({ getMaintenanceState: vi.fn() }));
vi.mock("@/lib/server/audit/audit-log", () => ({
  requestContext: () => ({ ip: "", userAgent: "test" }),
  writeAuditLog: vi.fn(),
}));
vi.mock("@/features/payments/server/payments.service", () => ({
  getTransactions: async () => [],
  getInvoiceSettings: async () => ({}),
  updateInvoiceSettings: vi.fn(),
  getPaymentAnalytics: async () => ({}),
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ general: {}, smtp: { password: "x" } }),
  updateSection: vi.fn(async () => ({ general: {} })),
  resetSection: vi.fn(),
  getPublicSettings: vi.fn(),
  getLabels: vi.fn(),
}));
vi.mock("@/lib/server/mail/send-test-email", () => ({ sendTestEmail: vi.fn() }));
vi.mock("@/features/content/server/content.service", () => ({
  getContentVersioned: async () => ({ version: 1 }),
  getContent: async () => [],
  getPublicContent: async () => [],
  replaceContent: vi.fn(async () => []),
}));
vi.mock("@/features/customers/server/customers.service", () => ({
  getCustomers: async () => [],
  getCustomer: async () => null,
  getCustomerMeta: async () => [],
  saveCustomerMeta: vi.fn(async () => ({})),
}));

import * as orders from "@/features/orders/server/order.controller";
import * as payments from "@/features/payments/server/payments.controller";
import * as settings from "@/features/settings/server/settings.controller";
import * as content from "@/features/content/server/content.controller";
import * as customers from "@/features/customers/server/customers.controller";
import { ALL_PERMISSIONS } from "@/features/team/lib/permissions";

function as(slug: string, sub = "u1") {
  const role = SYSTEM_ROLES.find((r) => r.slug === slug);
  const permissions = new Set<Permission>(slug === "owner" ? ALL_PERMISSIONS : (role?.permissions ?? []));
  signedIn.actor = { sub, email: `${slug}@example.com`, name: slug, role: slug, roleName: slug, isOwner: slug === "owner", permissions };
}
function asCustom(permissions: Permission[]) {
  signedIn.actor = { sub: "c1", email: "c@example.com", name: "c", role: "custom", roleName: "Custom", isOwner: false, permissions: new Set(permissions) };
}

const req = (body?: unknown, method = body ? "POST" : "GET") =>
  new Request("http://localhost/api/x", { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const id = (value = "o1") => ({ params: Promise.resolve({ id: value }) });
const key = (value: string) => ({ params: Promise.resolve({ key: value }) });
const section = (value: string) => ({ params: Promise.resolve({ section: value }) });

beforeEach(() => {
  signedIn.actor = null;
  order.current = {
    id: "o1",
    orderNumber: "BK-1",
    status: "ready",
    statusHistory: [],
    items: [],
    totals: { total: 500 },
    address: { fullName: "R", email: "r@example.com", phone: "1" },
    paymentMethod: "cod",
    paymentStatus: "cod",
    placedAt: "2026-10-30T00:00:00.000Z",
    deliveryPartner: { name: "Ravi", userId: "rider-1" },
  };
  order.updateStatus.mockReset().mockImplementation(async (_id: string, status: string) => ({ ...order.current, status }));
  order.cancel.mockReset().mockResolvedValue({});
  order.refund.mockReset().mockResolvedValue({});
});

describe("nobody signed in", () => {
  it("is 401 everywhere, before anything is read", async () => {
    expect((await orders.listOrdersController(req())).status).toBe(401);
    expect((await orders.kitchenQueueController()).status).toBe(401);
    expect((await payments.transactionsController()).status).toBe(401);
    expect((await settings.getSettingsController()).status).toBe(401);
    expect(order.getOrdersPage).not.toHaveBeenCalled();
  });
});

describe("kitchen staff", () => {
  beforeEach(() => as("kitchen-staff"));

  it("cannot read the order list, payments, revenue, settings or customers", async () => {
    expect((await orders.listOrdersController(req())).status).toBe(403);
    expect((await orders.getOrderController(req(), id())).status).toBe(403);
    expect((await orders.orderAnalyticsController(req())).status).toBe(403);
    expect((await payments.transactionsController()).status).toBe(403);
    expect((await customers.listCustomersController()).status).toBe(403);
    expect((await settings.updateSectionController(req({}, "PUT"), section("general"))).status).toBe(403);
  });

  it("gets the kitchen queue — without a price in it", async () => {
    const res = await orders.kitchenQueueController();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("BK-1");
    expect(text).not.toContain("r@example.com");
    expect(text).not.toContain('"totals"');
  });

  it("cannot cancel or refund", async () => {
    expect((await orders.cancelOrderController(req({}), id())).status).toBe(403);
    expect((await orders.refundOrderController(req({}), id())).status).toBe(403);
    expect(order.cancel).not.toHaveBeenCalled();
    expect(order.refund).not.toHaveBeenCalled();
  });

  it("may only make the kitchen's moves", async () => {
    order.current!.status = "confirmed";
    expect((await orders.updateStatusController(req({ status: "preparing" }, "PATCH"), id())).status).toBe(200);
    order.current!.status = "ready";
    expect((await orders.updateStatusController(req({ status: "out_for_delivery" }, "PATCH"), id())).status).toBe(403);
    expect(order.updateStatus).toHaveBeenCalledTimes(1);
  });
});

describe("delivery staff", () => {
  it("cannot touch an order assigned to someone else — and is told it does not exist", async () => {
    as("delivery-staff", "rider-2");
    const res = await orders.updateStatusController(req({ status: "out_for_delivery" }, "PATCH"), id());
    expect(res.status).toBe(404);
    expect(order.updateStatus).not.toHaveBeenCalled();
  });

  it("moves their own order, and only while it is still theirs", async () => {
    as("delivery-staff", "rider-1");
    const res = await orders.updateStatusController(req({ status: "out_for_delivery" }, "PATCH"), id());
    expect(res.status).toBe(200);
    expect(order.updateStatus).toHaveBeenCalledWith("o1", "out_for_delivery", expect.anything(), { assignedTo: "rider-1" });
    // The answer is the rider's view, not the whole order.
    const body = await res.json();
    expect(body.data).toHaveProperty("cashToCollect", 500);
    expect(JSON.stringify(body)).not.toContain("r@example.com");
  });

  it("cannot read the order list or the kitchen queue", async () => {
    as("delivery-staff", "rider-1");
    expect((await orders.listOrdersController(req())).status).toBe(403);
    expect((await orders.kitchenQueueController()).status).toBe(403);
  });
});

describe("a content editor", () => {
  beforeEach(() => as("content-editor"));

  it("cannot reach orders, payments, customers or settings", async () => {
    expect((await orders.listOrdersController(req())).status).toBe(403);
    expect((await payments.transactionsController()).status).toBe(403);
    expect((await customers.listCustomersController()).status).toBe(403);
    expect((await settings.updateSectionController(req({}, "PUT"), section("general"))).status).toBe(403);
  });

  it("can save banners, testimonials and FAQs", async () => {
    expect((await content.replaceContentController(req([], "PUT"), key("banners"))).status).toBe(200);
    expect((await content.replaceContentController(req([], "PUT"), key("faq"))).status).toBe(200);
  });
});

describe("a manager", () => {
  beforeEach(() => as("manager"));

  it("can cancel but cannot refund", async () => {
    expect((await orders.cancelOrderController(req({}), id())).status).toBe(200);
    expect((await orders.refundOrderController(req({}), id())).status).toBe(403);
    expect(order.refund).not.toHaveBeenCalled();
  });

  it("can see payments but not change the invoice settings", async () => {
    expect((await payments.transactionsController()).status).toBe(200);
    expect((await payments.updateInvoiceSettingsController(req({}, "PUT"))).status).toBe(403);
  });

  it("cannot change the shop's settings", async () => {
    expect((await settings.updateSectionController(req({}, "PUT"), section("general"))).status).toBe(403);
  });
});

describe("a custom role", () => {
  it("gets exactly what it lists: viewing orders is not cancelling them", async () => {
    asCustom(["orders.view"]);
    expect((await orders.listOrdersController(req())).status).toBe(200);
    expect((await orders.cancelOrderController(req({}), id())).status).toBe(403);
    expect((await orders.updateStatusController(req({ status: "delivered" }, "PATCH"), id())).status).toBe(403);
  });

  it("changing the sign-in policy is security.manage, not settings.manage", async () => {
    asCustom(["settings.view", "settings.manage"]);
    expect((await settings.updateSectionController(req({}, "PUT"), section("security"))).status).toBe(403);
  });
});
