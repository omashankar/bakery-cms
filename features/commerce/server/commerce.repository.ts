import { connectDB } from "@/lib/server/db/mongoose";
import { CouponModel, type CouponDoc } from "@/lib/server/db/models/coupon.model";
import { DeliveryZoneModel, type DeliveryZoneDoc } from "@/lib/server/db/models/delivery-zone.model";
import { buildDefaultCoupons, type StoredCoupon } from "@/features/commerce/lib/coupons-repository";
import { seedZones } from "@/features/commerce/lib/delivery-zones-repository";
import type { DeliveryZone } from "@/types/delivery";

/** Commerce repository — coupons + delivery zones collections. */

function stripDoc<T extends { id: string }>(item: T) {
  const { id, ...rest } = item;
  return { _id: id, ...rest };
}
function toItem<T>(raw: Record<string, unknown>): T {
  const { _id, __v, ...rest } = raw;
  void __v;
  return { ...rest, id: String(_id) } as T;
}

// ---- Coupons ----

export async function listCoupons(): Promise<StoredCoupon[]> {
  await connectDB();
  if ((await CouponModel.estimatedDocumentCount()) === 0) {
    try {
      await CouponModel.insertMany(buildDefaultCoupons().map(stripDoc) as CouponDoc[], { ordered: false });
    } catch {
      /* concurrent seed */
    }
  }
  const docs = (await CouponModel.find().sort({ createdAt: -1 }).lean()) as unknown as Record<string, unknown>[];
  return docs.map((d) => toItem<StoredCoupon>(d));
}

export async function replaceCoupons(coupons: StoredCoupon[]): Promise<void> {
  await connectDB();
  const keepIds = coupons.map((c) => c.id);
  const ops: Parameters<typeof CouponModel.bulkWrite>[0] = coupons.map((c) => ({
    replaceOne: { filter: { _id: c.id }, replacement: stripDoc(c) as CouponDoc, upsert: true },
  }));
  ops.push({ deleteMany: { filter: { _id: { $nin: keepIds } } } });
  await CouponModel.bulkWrite(ops);
}

/**
 * Counts one redemption, atomically.
 *
 * The counter used to be incremented from the BROWSER, through
 * `PUT /api/coupons` — a whole-collection replace that requires an admin role.
 * For a real customer that write was a guaranteed 403, and the result was
 * discarded, so `usageCount` only ever moved when an admin happened to check
 * out. The admin's coupon list has been showing the seed constant ever since.
 */
export async function incrementCouponUsage(code: string): Promise<void> {
  await adjustCouponUsage(code, 1);
}

/**
 * Give a redemption back when the order it belonged to is cancelled or refunded.
 *
 * Nothing ever did. `usageCount` only went up, so a coupon with a usage limit
 * was consumed by orders that never happened — and the coupon performance report
 * counted them as redemptions forever. Floored at zero: a count that has already
 * been corrected by hand must not go negative.
 */
export async function decrementCouponUsage(code: string): Promise<void> {
  await adjustCouponUsage(code, -1);
}

async function adjustCouponUsage(code: string, delta: number): Promise<void> {
  await connectDB();
  const normalized = code.trim().toUpperCase();
  const filter = {
    code: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    ...(delta < 0 ? { usageCount: { $gt: 0 } } : {}),
  };
  await CouponModel.updateOne(filter, { $inc: { usageCount: delta } });
}

// ---- Delivery zones ----

export async function listZones(): Promise<DeliveryZone[]> {
  await connectDB();
  if ((await DeliveryZoneModel.estimatedDocumentCount()) === 0) {
    try {
      await DeliveryZoneModel.insertMany(seedZones().map(stripDoc) as DeliveryZoneDoc[], { ordered: false });
    } catch {
      /* concurrent seed */
    }
  }
  const docs = (await DeliveryZoneModel.find().sort({ priority: -1 }).lean()) as unknown as Record<string, unknown>[];
  return docs.map((d) => toItem<DeliveryZone>(d));
}

export async function replaceZones(zones: DeliveryZone[]): Promise<void> {
  await connectDB();
  const keepIds = zones.map((z) => z.id);
  const ops: Parameters<typeof DeliveryZoneModel.bulkWrite>[0] = zones.map((z) => ({
    replaceOne: { filter: { _id: z.id }, replacement: stripDoc(z) as DeliveryZoneDoc, upsert: true },
  }));
  ops.push({ deleteMany: { filter: { _id: { $nin: keepIds } } } });
  await DeliveryZoneModel.bulkWrite(ops);
}
