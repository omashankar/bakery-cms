/**
 * A ZONE STORED TWICE KEEPS THE COPY THAT WAS JUST SAVED.
 *
 * The live collection held the Kota zone under an ObjectId _id AND under the
 * same hex as a string. A save writes the string copy and should then remove
 * the ObjectId twin. The first cut issued that delete through the Mongoose
 * model — whose `_id` is a String — so Mongoose cast the ObjectId to its hex
 * string and the delete removed the copy just saved, leaving the stale twin.
 * It did exactly that to the live Kota zone.
 *
 * The model is mocked to capture what each path is asked to do.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const state = vi.hoisted(() => ({
  ops: [] as Array<Record<string, unknown>>,
  nativeDeletes: [] as unknown[],
}));

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/server/db/cms-store", () => ({
  hasSeeded: async () => true,
  markSeeded: async () => undefined,
}));
vi.mock("@/lib/server/db/models/coupon.model", () => ({ CouponModel: {} }));
vi.mock("@/lib/server/db/models/delivery-zone.model", () => ({
  DeliveryZoneModel: {
    find: () => ({ select: () => ({ lean: async () => [] }) }),
    bulkWrite: async (ops: Array<Record<string, unknown>>) => {
      state.ops = ops;
    },
    collection: {
      deleteMany: async (filter: unknown) => {
        state.nativeDeletes.push(filter);
      },
    },
  },
}));

import { replaceZones } from "@/features/commerce/server/commerce.repository";

const HEX = "6ab10ecd09fe244839f47f5c";

function zone(id: string) {
  return {
    id,
    name: "Kota",
    city: "Kota",
    pincode: "324",
    radiusKm: 0,
    deliveryCharge: 99,
    minDeliveryDays: 0,
    estimatedDeliveryDays: 1,
    isActive: true,
    priority: 50,
    createdAt: "2026-09-21T11:02:37.183Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
  };
}

beforeEach(() => {
  state.ops = [];
  state.nativeDeletes = [];
});

describe("saving a zone whose id is ObjectId-shaped", () => {
  it("writes the string copy through the model", async () => {
    await replaceZones([zone(HEX)], [HEX]);
    expect(state.ops).toEqual([
      expect.objectContaining({ replaceOne: expect.objectContaining({ filter: { _id: HEX } }) }),
    ]);
  });

  it("removes only the ObjectId twin, on the native collection, never through the model", async () => {
    await replaceZones([zone(HEX)], [HEX]);
    expect(state.ops.some((op) => "deleteMany" in op)).toBe(false);
    expect(state.nativeDeletes).toHaveLength(1);
    const ids = (state.nativeDeletes[0] as { _id: { $in: unknown[] } })._id.$in;
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBeInstanceOf(Types.ObjectId);
    expect(String(ids[0])).toBe(HEX);
  });

  it("leaves an ordinary zone id alone", async () => {
    await replaceZones([zone("zone-kota")], ["zone-kota"]);
    expect(state.nativeDeletes).toEqual([]);
  });
});
