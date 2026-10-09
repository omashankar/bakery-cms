/**
 * "DELIVERY PARTNER CLEARED" — AND THE RIDER STAYED ON THE TRACKING PAGE.
 *
 * Blanking the internal notes or clearing the delivery partner reaches
 * `order.repository.patch` as `{ adminNotes: undefined }` /
 * `{ deliveryPartner: undefined }`. Mongoose drops undefined values from a
 * `$set`, so the update that reached the database changed `updatedAt` and
 * nothing else, while the admin was told it had worked.
 *
 * The model is mocked so the assertion is on the update document itself — the
 * thing Mongo would have been asked to do.
 */
import { describe, expect, it, vi } from "vitest";

const calls: unknown[] = [];

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/server/db/models/order.model", () => ({
  OrderModel: {
    findByIdAndUpdate: (_id: string, update: unknown) => {
      calls.push(update);
      return { lean: async () => null };
    },
  },
}));

import { patch } from "@/features/orders/server/order.repository";

describe("order patch", () => {
  it("removes a field passed as undefined instead of silently keeping it", async () => {
    calls.length = 0;
    await patch("o1", { adminNotes: undefined, deliveryPartner: undefined });
    const update = calls[0] as { $set: Record<string, unknown>; $unset?: Record<string, unknown> };

    expect(update.$unset).toEqual({ adminNotes: "", deliveryPartner: "" });
    expect(Object.keys(update.$set)).toEqual(["updatedAt"]);
  });

  it("still sets the fields it is given, and unsets nothing it was not", async () => {
    calls.length = 0;
    await patch("o1", { adminNotes: "Call before delivery" });
    const update = calls[0] as { $set: Record<string, unknown>; $unset?: unknown };

    expect(update.$set.adminNotes).toBe("Call before delivery");
    expect(update.$unset).toBeUndefined();
  });
});
