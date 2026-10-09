/**
 * A LEAKED 50%-OFF CODE, SWITCHED OFF ON A PHONE, WAS LIVE AGAIN BY THREE.
 *
 * Coupons and delivery zones are saved as the whole list from a browser cache
 * filled once per admin session. A laptop open since morning that toggled a
 * different coupon sent the leaked one back exactly as it was that morning —
 * active — and the server wrote it. Both saves reported success.
 *
 * Every edit now stamps `updatedAt`, and the server keeps a stored row whose
 * stamp is later than the incoming copy's. The model is mocked to capture the
 * operations the save would send to Mongo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  stored: [] as Array<{ _id: string; usageCount?: number; updatedAt?: string }>,
  ops: [] as unknown[],
}));

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/server/db/cms-store", () => ({
  hasSeeded: async () => true,
  markSeeded: async () => undefined,
}));
const model = vi.hoisted(() => () => ({
  find: () => ({ select: () => ({ lean: async () => state.stored }) }),
  bulkWrite: async (ops: unknown[]) => {
    state.ops = ops;
  },
}));
vi.mock("@/lib/server/db/models/coupon.model", () => ({ CouponModel: model() }));
vi.mock("@/lib/server/db/models/delivery-zone.model", () => ({ DeliveryZoneModel: model() }));

import { replaceCoupons, replaceZones } from "@/features/commerce/server/commerce.repository";

const MORNING = "2026-10-09T04:00:00.000Z";
const NOON = "2026-10-09T06:30:00.000Z";
const THREE = "2026-10-09T09:30:00.000Z";

function coupon(id: string, isActive: boolean, updatedAt: string) {
  return { id, code: id.toUpperCase(), label: "", description: "", isActive, usageCount: 0, createdAt: MORNING, updatedAt };
}

function written(): string[] {
  return (state.ops as Array<{ replaceOne?: { filter: { _id: string } } }>)
    .filter((op) => op.replaceOne)
    .map((op) => op.replaceOne!.filter._id);
}

describe("saving the coupon list from a stale tab", () => {
  beforeEach(() => {
    state.ops = [];
  });

  it("keeps the coupon another device changed since, and writes the one this tab changed", async () => {
    // Stored: LEAK50 was switched off at noon; WELCOME10 untouched since morning.
    state.stored = [
      { _id: "leak50", updatedAt: NOON },
      { _id: "welcome10", updatedAt: MORNING },
    ];

    // The laptop's list: LEAK50 as it was this morning, WELCOME10 toggled now.
    await replaceCoupons(
      [coupon("leak50", true, MORNING), coupon("welcome10", false, THREE)] as never,
      ["leak50", "welcome10"],
    );

    expect(written()).toEqual(["welcome10"]);
  });

  it("still writes a row this tab changed after the other device did", async () => {
    state.stored = [{ _id: "leak50", updatedAt: NOON }];
    await replaceCoupons([coupon("leak50", true, THREE)] as never, ["leak50"]);
    expect(written()).toEqual(["leak50"]);
  });

  it("applies the same rule to delivery zones", async () => {
    state.stored = [{ _id: "zone-1", updatedAt: NOON }];
    await replaceZones(
      [{ id: "zone-1", name: "Central", updatedAt: MORNING, createdAt: MORNING }] as never,
      ["zone-1"],
    );
    expect(written()).toEqual([]);
  });
});
