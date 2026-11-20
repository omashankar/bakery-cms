/**
 * A CUSTOMER CAN DELETE THEIR OWN ACCOUNT.
 *
 * App stores refuse an app that lets people sign up but not leave. These pin
 * what "delete" means here: the account and its photo go, the orders stay
 * (they are the shop's invoices), the cookie is cleared, and another site
 * cannot ask for it. Repository, image host and audit log are mocked, so this
 * exercises the decisions, not Mongo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ deleteAccount: vi.fn() }));
vi.mock("@/features/customer-auth/server/customer-auth.repository", () => repo);

const media = vi.hoisted(() => ({
  deleteFromCloudinary: vi.fn(),
  isCloudinaryConfigured: vi.fn(() => true),
  uploadToCloudinary: vi.fn(),
}));
vi.mock("@/lib/server/media/cloudinary", () => media);

const audit = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
  requestContext: vi.fn(() => ({ ip: "", userAgent: "probe" })),
}));
vi.mock("@/lib/server/audit/audit-log", () => audit);

const session = vi.hoisted(() => ({
  requireCustomer: vi.fn(),
  getCustomerAccount: vi.fn(),
}));
vi.mock("@/lib/server/auth/customer-dal", () => session);

const cookies = vi.hoisted(() => ({
  clearCustomerCookie: vi.fn(),
  setCustomerCookie: vi.fn(),
}));
vi.mock("@/lib/server/auth/cookies", () => cookies);

const orders = vi.hoisted(() => ({ findByCustomerEmail: vi.fn() }));
vi.mock("@/features/orders/server/order.repository", () => orders);

const { deleteAccount } = await import("@/features/customer-auth/server/customer-auth.service");
const { deleteMyAccountController } = await import(
  "@/features/customer-auth/server/customer-auth.controller"
);

const ctx = { ip: "", userAgent: "probe" };

function deleteRequest(headers: Record<string, string>) {
  return new Request("http://shop.test/api/customer-auth/me", {
    method: "DELETE",
    headers: { host: "shop.test", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.requireCustomer.mockResolvedValue({ id: "acc-1", email: "asha@example.com", name: "Asha" });
  repo.deleteAccount.mockResolvedValue({ email: "asha@example.com", avatarPublicId: "avatars/a1" });
});

describe("deleting the account", () => {
  it("removes the account, then its photo, and records who asked", async () => {
    await deleteAccount("acc-1", ctx);

    expect(repo.deleteAccount).toHaveBeenCalledWith("acc-1");
    expect(media.deleteFromCloudinary).toHaveBeenCalledWith("avatars/a1");
    expect(repo.deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
      media.deleteFromCloudinary.mock.invocationCallOrder[0],
    );
    expect(audit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.account.deleted", actorEmail: "asha@example.com" }),
    );
  });

  it("asks the image host for nothing when there was no photo", async () => {
    repo.deleteAccount.mockResolvedValue({ email: "asha@example.com", avatarPublicId: "" });
    await deleteAccount("acc-1", ctx);
    expect(media.deleteFromCloudinary).not.toHaveBeenCalled();
  });

  it("answers 'sign in again' for an account that is already gone", async () => {
    repo.deleteAccount.mockResolvedValue(null);
    await expect(deleteAccount("acc-1", ctx)).rejects.toMatchObject({ status: 401 });
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("never reads or writes an order", async () => {
    await deleteAccount("acc-1", ctx);
    expect(orders.findByCustomerEmail).not.toHaveBeenCalled();
  });
});

describe("the endpoint", () => {
  it("deletes from the shop's own origin and signs this device out", async () => {
    const response = await deleteMyAccountController(deleteRequest({ origin: "http://shop.test" }));

    expect(response.status).toBe(200);
    expect(repo.deleteAccount).toHaveBeenCalledWith("acc-1");
    expect(cookies.clearCustomerCookie).toHaveBeenCalled();
  });

  it("refuses another site, and one that names no origin at all", async () => {
    const attempts: Record<string, string>[] = [
      { origin: "https://evil.test" },
      { "sec-fetch-site": "cross-site" },
      {},
    ];
    for (const headers of attempts) {
      const response = await deleteMyAccountController(deleteRequest(headers));
      expect(response.status).toBe(403);
    }
    expect(repo.deleteAccount).not.toHaveBeenCalled();
    expect(cookies.clearCustomerCookie).not.toHaveBeenCalled();
  });

  it("deletes nothing for a visitor who is not signed in", async () => {
    const { AuthError } = await import("@/lib/server/http/errors");
    session.requireCustomer.mockRejectedValue(new AuthError());

    const response = await deleteMyAccountController(deleteRequest({ origin: "http://shop.test" }));

    expect(response.status).toBe(401);
    expect(repo.deleteAccount).not.toHaveBeenCalled();
  });
});
