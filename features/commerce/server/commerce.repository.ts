import { connectDB } from "@/lib/server/db/mongoose";
import { hasSeeded, markSeeded } from "@/lib/server/db/cms-store";
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

const COUPONS_SEED_KEY = "coupons";

export async function listCoupons(): Promise<StoredCoupon[]> {
  await connectDB();
  // Seed ONCE, not "whenever empty".
  //
  // The same bug the zones below were fixed for, left in place here in the same
  // file. "Empty" cannot tell a brand new shop from one that deliberately
  // deleted every coupon, so clearing them resurrected the demo codes on the
  // very next read — and a coupon is not a display row: `getCoupons` is what
  // `priceCart` resolves a code against, so WELCOME10 came back from the dead
  // and took 10% off a live checkout. The admin saw "Deleted 4 coupons",
  // reloaded, and the same four were back.
  if (
    (await CouponModel.estimatedDocumentCount()) === 0 &&
    !(await hasSeeded(COUPONS_SEED_KEY))
  ) {
    try {
      await CouponModel.insertMany(buildDefaultCoupons().map(stripDoc) as CouponDoc[], { ordered: false });
      // Inside the try, for the reason spelled out on the zones seed: marking
      // outside it records "already seeded" over a collection that stayed empty
      // after a transient write failure, and no code path could ever seed it.
      await markSeeded(COUPONS_SEED_KEY);
    } catch {
      /* concurrent seed, or a transient write failure — retry on the next read */
    }
  }
  const docs = (await CouponModel.find().sort({ createdAt: -1 }).lean()) as unknown as Record<string, unknown>[];
  return docs.map((d) => toItem<StoredCoupon>(d));
}

export async function replaceCoupons(coupons: StoredCoupon[]): Promise<void> {
  await connectDB();
  // Any deliberate write settles the seeding question, including a write of
  // none — deleting every coupon is exactly the case the marker exists for.
  await markSeeded(COUPONS_SEED_KEY);

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

/** Marker key recording that the demo zones have been planted once. */
const ZONES_SEED_KEY = "delivery-zones";

export async function listZones(): Promise<DeliveryZone[]> {
  await connectDB();
  // Seed ONCE, not "whenever empty".
  //
  // "Empty" cannot distinguish a brand new shop from one that deliberately
  // deleted every zone — so deleting them all silently resurrected the demo rows
  // on the very next read, and those rows then PRICED live checkouts. The admin
  // saw "Deleted 5 zones", reloaded, and the same five were back.
  if (
    (await DeliveryZoneModel.estimatedDocumentCount()) === 0 &&
    !(await hasSeeded(ZONES_SEED_KEY))
  ) {
    try {
      await DeliveryZoneModel.insertMany(seedZones().map(stripDoc) as DeliveryZoneDoc[], { ordered: false });
      // ONLY on success. The marker was set outside this try, so a transient
      // failure — a dropped connection, a write timeout — recorded "already
      // seeded" over a collection that had stayed empty, and the shop could then
      // never be given zones by any code path. The catch is written for a
      // duplicate-key race and swallows everything, so it cannot tell the two
      // apart; leaving the marker unset means the next read simply tries again.
      await markSeeded(ZONES_SEED_KEY);
    } catch {
      /* concurrent seed, or a transient write failure — retry on the next read */
    }
  }
  const docs = (await DeliveryZoneModel.find().sort({ priority: -1 }).lean()) as unknown as Record<string, unknown>[];
  return docs.map((d) => toItem<DeliveryZone>(d));
}

export async function replaceZones(
  zones: DeliveryZone[],
  /**
   * The ids the caller believed existed before its edit.
   *
   * `null` means it did not say — an older client — and then nothing outside the
   * incoming list is touched, which is the safe reading.
   */
  knownIds: string[] | null = null,
): Promise<void> {
  await connectDB();
  // Any deliberate write settles the seeding question, including a write of
  // none — that is the case the marker exists for.
  await markSeeded(ZONES_SEED_KEY);

  const keepIds = zones.map((z) => z.id);
  const ops: Parameters<typeof DeliveryZoneModel.bulkWrite>[0] = zones.map((z) => ({
    replaceOne: { filter: { _id: z.id }, replacement: stripDoc(z) as DeliveryZoneDoc, upsert: true },
  }));

  // Delete only what the caller HAD and has now dropped.
  //
  // This was `{ _id: { $nin: keepIds } }` — "delete everything I did not send" —
  // so a save from a tab opened before another admin added a zone silently
  // removed it. Both saves reported success and one admin's work was gone with
  // nothing to show it had ever existed.
  const removedIds =
    knownIds === null ? [] : knownIds.filter((id) => !keepIds.includes(id));

  if (removedIds.length > 0) {
    ops.push({ deleteMany: { filter: { _id: { $in: removedIds } } } });
  }

  if (ops.length > 0) await DeliveryZoneModel.bulkWrite(ops);
}
