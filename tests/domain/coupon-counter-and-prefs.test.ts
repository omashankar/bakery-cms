import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";

/**
 * Two server-owned things the client was allowed to assert.
 *
 * `usageCount` is incremented atomically by `placeOrder` as customers redeem —
 * and every admin save wrote back whatever number the tab had cached. An admin
 * who opened the page at 09:00, watched ten redemptions land and flipped an
 * unrelated switch at 17:00 silently reset that coupon to its 09:00 count.
 * `resetCoupons` was worse: it wrote the seed constants 12 / 4 / 28 / 0 over the
 * live figures. So "N redemptions" on the screen was whatever the last tab held.
 *
 * And the payment notification switches stored a preference nothing read, so an
 * admin who turned the payment-success mail off got a green toast and the next
 * order sent it anyway.
 */

const config = vi.hoisted(() => ({ prefs: {} as Record<string, unknown> }));

const db = vi.hoisted(() => ({
  coupons: new Map<string, Record<string, unknown>>(),
  bulkOps: [] as unknown[],
}));

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: async () => ({}) }));
vi.mock("@/lib/server/audit/audit-log", () => ({ writeAuditLog: vi.fn(async () => {}) }));

vi.mock("@/lib/server/db/cms-store", () => ({
  createMongoStore: () => ({
    read: async () => ({}),
    readVersioned: async () => ({ value: {}, version: 0 }),
    writeVersioned: async () => ({ value: {}, version: 1 }),
    write: async () => {},
    mutate: async () => undefined,
    reset: async () => {},
  }),
  hasSeeded: async () => true,
  markSeeded: async () => {},
  StoreConflictError: class extends Error {},
}));

vi.mock("@/lib/server/db/models/coupon.model", () => ({
  CouponModel: {
    find: () => ({
      select: () => ({
        lean: async () => [...db.coupons.values()],
      }),
    }),
    bulkWrite: async (ops: unknown[]) => {
      db.bulkOps = ops;
      for (const op of ops as Record<string, never>[]) {
        const replace = (op as Record<string, { filter: { _id: string }; replacement: Record<string, unknown> }>)
          .replaceOne;
        if (replace) {
          db.coupons.set(replace.filter._id, {
            _id: replace.filter._id,
            ...replace.replacement,
          });
        }
      }
    },
    estimatedDocumentCount: async () => db.coupons.size,
    insertMany: async () => {},
    find_: undefined,
  },
}));

import { replaceCoupons } from "@/features/commerce/server/commerce.repository";

function coupon(over: Partial<StoredCoupon> & { id: string }): StoredCoupon {
  return {
    code: over.id.toUpperCase(),
    label: "",
    description: "",
    isActive: true,
    usageCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  } as StoredCoupon;
}

describe("the redemption counter", () => {
  beforeEach(() => {
    db.coupons.clear();
    db.bulkOps = [];
    db.coupons.set("c1", { _id: "c1", code: "WELCOME10", usageCount: 38 });
  });

  it("keeps the count the shop earned, not the one the tab cached", async () => {
    // The admin's tab still holds 28 from this morning; ten redemptions landed
    // since.
    await replaceCoupons([coupon({ id: "c1", usageCount: 28 })], ["c1"]);

    expect(db.coupons.get("c1")?.usageCount).toBe(38);
  });

  it("survives a reset that writes the seed constants over it", async () => {
    await replaceCoupons([coupon({ id: "c1", usageCount: 0 })], ["c1"]);

    expect(db.coupons.get("c1")?.usageCount).toBe(38);
  });

  it("starts a brand new coupon at what it was created with", async () => {
    await replaceCoupons([coupon({ id: "new", usageCount: 0 })], []);

    expect(db.coupons.get("new")?.usageCount).toBe(0);
  });

  it("still stores everything else the admin changed", async () => {
    await replaceCoupons(
      [coupon({ id: "c1", usageCount: 28, percentOff: 5, isActive: false })],
      ["c1"],
    );

    expect(db.coupons.get("c1")?.percentOff).toBe(5);
    expect(db.coupons.get("c1")?.isActive).toBe(false);
  });
});

describe("what a coupon save may delete", () => {
  beforeEach(() => {
    db.coupons.clear();
    db.bulkOps = [];
  });

  function deleteFilter() {
    const op = (db.bulkOps as Record<string, { filter: { _id: Record<string, string[]> } }>[]).find(
      (candidate) => candidate.deleteMany,
    );
    return op?.deleteMany?.filter?._id;
  }

  it("deletes nothing when the caller does not say what it knew", async () => {
    await replaceCoupons([coupon({ id: "c1" })], null);

    expect(deleteFilter()).toBeUndefined();
  });

  it("deletes only what the caller had and has now dropped", async () => {
    await replaceCoupons([coupon({ id: "c1" })], ["c1", "c2"]);

    expect(deleteFilter()).toEqual({ $in: ["c2"] });
  });

  it("leaves a coupon this tab never saw alone", async () => {
    // Another admin created DIWALI30 after this tab loaded.
    await replaceCoupons([coupon({ id: "c1" })], ["c1"]);

    expect(deleteFilter()).toBeUndefined();
  });
});

describe("payment notification switches", () => {
  beforeEach(() => {
    config.prefs = {};
    vi.resetModules();
  });

  async function isEnabled(id: string, channel: "in_app" | "email" | "whatsapp") {
    vi.doMock("@/features/admin-config/server/admin-config.service", () => ({
      getAdminConfig: async () => config.prefs,
    }));
    const mod = await import("@/features/payments/server/notification-prefs.server");
    return mod.isNotificationEnabled(id, channel);
  }

  it("is on for anything the admin has never touched", async () => {
    expect(await isEnabled("cust_payment_success", "email")).toBe(true);
  });

  it("is off once the admin switches it off", async () => {
    config.prefs = { cust_payment_success: { enabled: false } };

    expect(await isEnabled("cust_payment_success", "email")).toBe(false);
  });

  it("respects a channel the admin removed", async () => {
    config.prefs = { cust_payment_success: { enabled: true, channels: ["in_app"] } };

    expect(await isEnabled("cust_payment_success", "email")).toBe(false);
    expect(await isEnabled("cust_payment_success", "in_app")).toBe(true);
  });

  it("does not silence a different event", async () => {
    config.prefs = { cust_payment_success: { enabled: false } };

    expect(await isEnabled("admin_payment_received", "email")).toBe(true);
  });

  it("sends anyway if the preferences cannot be read", async () => {
    // Silence is the worse failure: an order confirmation must not be lost to a
    // settings read.
    vi.resetModules();
    vi.doMock("@/features/admin-config/server/admin-config.service", () => ({
      getAdminConfig: async () => {
        throw new Error("mongo down");
      },
    }));
    const mod = await import("@/features/payments/server/notification-prefs.server");

    expect(await mod.isNotificationEnabled("cust_payment_success", "email")).toBe(true);
  });
});
